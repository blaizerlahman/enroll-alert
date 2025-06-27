package enrollalert

import (
	"context"
	"fmt"
	"strconv"
	"github.com/jackc/pgx/v5/pgxpool"
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

	// queries any alerts that have been set off by new course seat data
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
		var alert alertRow
		if err := rows.Scan(
			&alert.userID,
			&alert.email,
			&alert.courseID,
			&alert.courseName,
			&alert.sectionNum,
			&alert.alertType,
			&alert.seatThreshold,
			&alert.openSeats,
		); err != nil {
			return err
		}
		if alert.email == "" {
			continue
		}

		// composing email
		sub := "Course Alert"
		html := fmt.Sprintf(`
			<p><strong>Enroll Alert!</strong></p>

			<p>%s section %s now has %d open seat(s).</p>

			<p>You will no longer receive alerts for %s section %s.
			If you would like to set up a new alert, please visit
			<a href="https://enrollalert.com">enrollalert.com</a>.</p>

			<p>Happy enrolling!</p>`,
					alert.courseName, alert.sectionNum, alert.openSeats,
					alert.courseName, alert.sectionNum,
		)

		text := fmt.Sprintf(
			"Enroll Alert!\n\n"+
				"%s section %s now has %d open seat(s).\n\n"+
				"You will no longer receive alerts for %s section %s.\n"+
				"To create a new alert, visit https://enrollalert.com.\n\n"+
				"Happy enrolling!",
			alert.courseName, alert.sectionNum, alert.openSeats,
			alert.courseName, alert.sectionNum,
		)

			// send email
		if err := mail.Send(alert.email, sub, html, text); err != nil {
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
		`, alert.userID, alert.courseID, alert.sectionNum, alert.alertType, alert.seatThreshold); err != nil {
			return err
		}
	}
	return rows.Err()
}

