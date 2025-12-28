package enrollalert

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// CheckAggregate Checks temp_logs table to see if a new day has begun, and if so we should aggregate the table.
// Returns true if current day is after day of the oldest log, false if otherwise
func CheckAggregate(ctx context.Context, pool *pgxpool.Pool) (bool, error) {

	var needAggregate bool

	// see if current day is now different than day of earliest log (central time)
	// indicates that a day has passed and we should now create daily log
	// returns false if no logs
	err := pool.QueryRow(ctx, `
		SELECT
			COALESCE(
				DATE(MIN(created_at) AT TIME ZONE 'America/Chicago') < DATE(NOW() AT TIME ZONE 'America/Chicago'),
				false
			)
		FROM temp_logs
	`).Scan(&needAggregate)
	if err != nil {
		return false, err
	}

	return needAggregate, nil
}

// AggregateLogs Executes queries to obtain aggregate info from temp_logs table
// and clears temp_logs table upon finish if successful. Does so as a transaction to
// prevent partial writes/failures.
// Returns error if one occurs.
func AggregateLogs(ctx context.Context, pool *pgxpool.Pool) error {

	transact, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer transact.Rollback(ctx)

	// query temp_logs, users, and user_courses to get aggregate data for daily_logs table
	// (most of query is self-explainable)
	_, err = transact.Exec(ctx, `
		INSERT INTO daily_logs (
			day,
			user_count,
			total_alerts_set_count,
			total_alerts_sent_count,
			current_alerts_set_count,
			daily_alerts_set_count,
			daily_alerts_sent_count,
			most_set_course_id,
			most_sent_course_id,
			most_set_course,
			most_sent_course,
			most_set_count,
			most_sent_count,
			most_set_hour,
			most_sent_hour,
			min_time_to_send,
			max_time_to_send,
			avg_time_to_send
		)
		SELECT
			agg.day,
			agg.user_count,
			COALESCE(totals.total_alerts_set_count, 0) + agg.daily_alerts_set_count,
			COALESCE(totals.total_alerts_sent_count, 0) + agg.daily_alerts_sent_count,
			agg.current_alerts_set_count,
			agg.daily_alerts_set_count,
			agg.daily_alerts_sent_count,
			most_set.course_id,
			most_sent.course_id,
			most_set.course_name,
			most_sent.course_name,
			COALESCE(most_set.total, 0),
			COALESCE(most_sent.total, 0),
			COALESCE(most_set_hour.hour, -1),
			COALESCE(most_sent_hour.hour, -1),
			min_time.time,
			max_time.time,
			avg_time.time
		FROM (
			SELECT
				DATE(created_at AT TIME ZONE 'America/Chicago') AS day,
				(SELECT COUNT(*) FROM users) AS user_count,
				(SELECT COUNT(*) FROM user_courses) AS current_alerts_set_count,
				COUNT(*) FILTER (WHERE log_type = 'SET') AS daily_alerts_set_count,
				COUNT(*) FILTER (WHERE log_type = 'SENT') AS daily_alerts_sent_count
			FROM temp_logs
			GROUP BY DATE(created_at AT TIME ZONE 'America/Chicago')
		) agg
		LEFT JOIN LATERAL (
			SELECT total_alerts_set_count, total_alerts_sent_count
			FROM daily_logs
			ORDER BY day DESC
			LIMIT 1
		) totals ON true
		LEFT JOIN LATERAL (
			SELECT course_id, course_name, COUNT(*) AS total
			FROM temp_logs
			WHERE log_type = 'SET'
			GROUP BY course_id, course_name
			ORDER BY total DESC
			LIMIT 1
		) most_set ON true
		LEFT JOIN LATERAL (
			SELECT course_id, course_name, COUNT(*) AS total
			FROM temp_logs
			WHERE log_type = 'SENT'
			GROUP BY course_id, course_name
			ORDER BY total DESC
			LIMIT 1
		) most_sent ON true
		LEFT JOIN LATERAL (
			SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Chicago')::smallint AS hour
			FROM temp_logs
			WHERE log_type = 'SET'
			GROUP BY 1
			ORDER BY COUNT(*) DESC
			LIMIT 1
		) most_set_hour ON true
		LEFT JOIN LATERAL (
			SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/Chicago')::smallint AS hour
			FROM temp_logs
			WHERE log_type = 'SENT'
			GROUP BY 1
			ORDER BY COUNT(*) DESC
			LIMIT 1
		) most_sent_hour ON true
		LEFT JOIN LATERAL (
			SELECT MIN(time_to_send) AS time
			FROM temp_logs
			WHERE log_type = 'SENT'
		) min_time ON true
		LEFT JOIN LATERAL (
			SELECT MAX(time_to_send) AS time
			FROM temp_logs
			WHERE log_type = 'SENT'
		) max_time ON true
		LEFT JOIN LATERAL (
			SELECT AVG(time_to_send) AS time
			FROM temp_logs
			WHERE log_type = 'SENT'
		) avg_time ON true;
	`)
	if err != nil {
		return err
	}

	// query for upating course send times in courses table (eventually to be displayed on site)
	_, err = transact.Exec(ctx, `
		UPDATE courses c
		SET
				total_sends = c.total_sends + agg.total_sends,
				total_time_to_send = c.total_time_to_send + agg.total_time_to_send,
				min_time_to_send = COALESCE(
						LEAST(c.min_time_to_send, agg.min_time_to_send),
						agg.min_time_to_send
				),
				max_time_to_send = COALESCE(
						GREATEST(c.max_time_to_send, agg.max_time_to_send),
						agg.max_time_to_send
				)
		FROM (
				SELECT
						course_id,
						term,
						COUNT(*) AS total_sends,
						SUM(time_to_send) AS total_time_to_send,
						MIN(time_to_send) AS min_time_to_send,
						MAX(time_to_send) AS max_time_to_send
				FROM temp_logs
				WHERE log_type = 'SENT'
				GROUP BY course_id, term
		) agg
		WHERE c.course_id = agg.course_id AND c.term = agg.term;
	`)
	if err != nil {
		return err;
	}

	// clear temp logs after aggregate has been made
	_, err = transact.Exec(ctx, `DELETE FROM temp_logs`)
	if err != nil {
		return err
	}

	return transact.Commit(ctx)
}
