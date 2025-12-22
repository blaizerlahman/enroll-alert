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
		INTERT INTO daily_logs (
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
			most_sent_hour
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
			most_set.count,
			most_sent.count,
			most_set_hour.hour,
			most_sent_hour.hour

		FROM (
			SELECT
				DATE(MIN(created_at) AT TIME ZONE 'America/Chicago') AS day,
				(SELECT COUNT(*) FROM users) AS user_count,
				(SELECT COUNT(*) FROM user_courses) AS current_alerts_set_count,
				COUNT(*) FILTER (WHERE log_type = 'SET') AS daily_alerts_set_count,
				COUNT(*) FILTER (WHERE log_type = 'SENT') AS daily_alerts_sent_count
			FROM temp_logs
		) agg

		LEFT JOIN LATERAL (
			SELECT total_alerts_set_count, total_alerts_sent_count
			FROM daily_logs
			ORDER BY day DESC
			LIMIT 1
		) totals ON true

		LEFT JOIN LATERAL (
			SELECT course_id, course_name, COUNT(*) as total
			FROM temp_logs
			WHERE log_type = 'SET'
			GROUP BY course_id, course_name
			ORDER BY total DESC
			LIMIT 1
		) most_set ON true
			
		LEFT JOIN LATERAL (
			SELECT course_id, course_name, COUNT(*) as total
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
		) most_sent_hour ON true;
	`)
	if err != nil {
		return err
	}
	
	// clear temp logs after aggregate has been made
	_, err = transact.Exec(ctx, `DELETE FROM temp_logs`)
	if err != nil {
		return err
	}

	return transact.Commit(ctx)
}
