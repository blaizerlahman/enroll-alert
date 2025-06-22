package enrollalert

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"strconv"
)

type alertRow struct {
	userID       int
	email        string
	courseID     string
	courseName   string
	sectionNum   string
	alertType    string
	seatThreshold *int
	openSeats    int
}

// NotifyMatchingAlerts Looks at newly updated courses and sends email alerts to users if the courses
// now fit their specified alert. Removes course from user's alert list once email is sent.
// Returns error if issue arrises during querying or email sending.
func NotifyMatchingAlerts(ctx context.Context, pool *pgxpool.Pool, mail *EmailClient, term int) error {

	rows, err := pool.Query(ctx, `
		SELECT uc.user_id,
		       u.email,
		       uc.course_id,
		       cs.course_name,
		       uc.section_num,
		       uc.alert_type,
		       uc.seat_threshold,
		       cs.open_seats
		FROM user_courses uc
		JOIN users u ON u.id = uc.user_id
		JOIN course_sections cs
		     ON cs.course_id   = uc.course_id
		    AND cs.section_num = uc.section_num
		    AND cs.term        = $1
		WHERE (
			  uc.alert_type = 'any'      AND cs.open_seats > 0
		   OR uc.alert_type = 'threshold' AND cs.open_seats <= uc.seat_threshold
		)
	`, term)

	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var a alertRow
		if err := rows.Scan(
			&a.userID,
			&a.email,
			&a.courseID,
			&a.courseName,
			&a.sectionNum,
			&a.alertType,
			&a.seatThreshold,
			&a.openSeats,
		); err != nil {
			return err
		}
		if a.email == "" {
			continue
		}

		// composing email
		sub := "Seat alert"
		html := "<p>" + a.courseName + " section " + a.sectionNum +
			" now has " + strconv.Itoa(a.openSeats) + " open seat(s).</p>"
		text := a.courseName + " section " + a.sectionNum +
			" now has " + strconv.Itoa(a.openSeats) + " open seat(s)."

			// send email
		if err := mail.Send(a.email, sub, html, text); err != nil {
			return err
		}

		// delete course alert after email is sent
		if _, err := pool.Exec(ctx, `
			DELETE FROM user_courses
			WHERE user_id       = $1
			  AND course_id     = $2
			  AND section_num   = $3
			  AND alert_type    = $4
			  AND (seat_threshold IS NOT DISTINCT FROM $5)
		`, a.userID, a.courseID, a.sectionNum, a.alertType, a.seatThreshold); err != nil {
			return err
		}
	}
	return rows.Err()
}

