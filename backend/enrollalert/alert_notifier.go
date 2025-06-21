package enrollalert

import (
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
	"strconv"
)

type alertRow struct {
	email      string
	courseName string
	sectionNum string
	openSeats  int
}

func NotifyMatchingAlerts(ctx context.Context, pool *pgxpool.Pool, mail *EmailClient, term int) error {

	rows, err := pool.Query(ctx, `
		SELECT u.email,
		       cs.course_name,
		       uc.section_num,
		       cs.open_seats
		FROM user_courses uc
		JOIN users u ON u.id = uc.user_id
		JOIN course_sections cs
		     ON cs.course_id   = uc.course_id
		    AND cs.section_num = uc.section_num
		    AND cs.term        = $1
		WHERE (
			  uc.alert_type = 'any'      AND cs.open_seats > 0
		   OR uc.alert_type = 'threshold' AND cs.open_seats >= uc.seat_threshold
		)
	`, term)

	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var a alertRow

		if err := rows.Scan(&a.email, &a.courseName, &a.sectionNum, &a.openSeats); err != nil {
			return err
		}

		if a.email == "" {
			continue
		}

		sub := "Seat alert"
		html := "<p>" + a.courseName + " section " + a.sectionNum + " now has " + strconv.Itoa(a.openSeats) + " open seat(s).</p>"
		text := a.courseName + " section " + a.sectionNum + " now has " + strconv.Itoa(a.openSeats) + " open seat(s)."

		if err := mail.Send(a.email, sub, html, text); err != nil {
			return err
		}
	}

	return rows.Err()
}

