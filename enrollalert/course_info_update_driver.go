package enrollalert

import (
	"context"
	"fmt"
	"strconv"
	"github.com/jackc/pgx/v5"
)

type CourseCodes struct {
	CourseID   string
	SubjectID  string
	CourseName   string
}

// getCourseCodesFromDB Queries course and subject codes using course name and creates a list of
// CourseCodes containing subject/course ID's and course name
// returns a list of pointers to CourseCodes containing course information
func getCourseCodesFromDB(conn *pgx.Conn, courseNames []string) ([]*CourseCodes, error) {

	// SQL query for course/subject id and name
	query := `
		SELECT course_id, subject_id, course_name
		FROM public.courses
		WHERE course_name = ANY($1);
	`

	// perform query
	rows, err := conn.Query(context.Background(), query, courseNames)
	if err != nil {
		return nil, fmt.Errorf("Error with query %s: %w", query, err)
	}
	defer rows.Close()

	var queryResults []*CourseCodes

	// iterate through rows and create CourseCodes objects from data in rows
	for rows.Next() {
		var currCourse CourseCodes
		if err := rows.Scan(&currCourse.CourseID, &currCourse.SubjectID, &currCourse.CourseName); err != nil {
			return nil, fmt.Errorf("Error with row scan: %w", err)
		}
		queryResults = append(queryResults, &currCourse)
	}

	if rows.Err() != nil {
		return nil, fmt.Errorf("Error with iteration: %w", rows.Err())
	}

	return queryResults, nil
}

func updateSeatInfoDB(conn *pgx.Conn, coursesSeatInfo []*Course) error {

	query := `
		INSERT INTO course_sections (
			term, course_id, section_num, section_type, subject_id, course_name,
			capacity, enrolled, open_seats, waitlist_capacity, waitlist_open_spots, last_updated
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
		ON CONFLICT (course_id, section_num)
		DO UPDATE SET
			section_type = EXCLUDED.section_type,
			subject_id = EXCLUDED.subject_id,
			course_name = EXCLUDED.course_name,
			capacity = EXCLUDED.capacity,
			enrolled = EXCLUDED.enrolled,
			open_seats = EXCLUDED.open_seats,
			waitlist_capacity = EXCLUDED.waitlist_capacity,
			waitlist_open_spots = EXCLUDED.waitlist_open_spots,
			last_updated = CURRENT_TIMESTAMP;
	`

	termNum, err := strconv.Atoi(Term)
	if err != nil {
		return fmt.Errorf("Error with converting term to int: %w", err)
	}

	for _, course := range coursesSeatInfo {
		for _, enrollmentPackage := range course.EnrollmentPackages {
			for _, section := range enrollmentPackage.Sections {	
				
				_, err := conn.Exec(context.Background(), query,

					termNum, section.CourseID, section.SectionNumber, section.ClassType, section.Subject.SubjectID,
				  fmt.Sprintf("%s %s", section.Subject.ShortDesc, section.CatalogNumber), 
				  section.EnrollmentStatus.Capacity, section.EnrollmentStatus.CurrentlyEnrolled,
					section.EnrollmentStatus.OpenSeats, section.EnrollmentStatus.WaitlistCapacity,
				  section.EnrollmentStatus.WaitlistOpenSpots,
				)

				if err != nil {
					return fmt.Errorf("Failed to insert section %s course %s: %w",
						section.SectionNumber, section.CourseID, err)
				}
			}
		}
	}

	return nil
}

// CourseInfoUpdateDriver Retrieves course/subject ID from Postgres database and uses info to scrape
// course seat info from UW Madison enrollment API. Uses scraped data to update Postgres database for
// specified courses
// Returns error on failure
func CourseInfoUpdateDriver(conn *pgx.Conn, courseNames []string) error {

	// get course codes from database for specified courses
	courseCodes, err := getCourseCodesFromDB(conn, courseNames)
	if err != nil {
		return fmt.Errorf("Error with retrieving course info from database: %w", err)
	}

	coursesSeatInfo := courseInfoScrape(courseCodes)

	// for _, c := range coursesSeatInfo {
	// 	for _, d := range c.EnrollmentPackages {
	// 		for _, m := range d.Sections {
	// 			fmt.Printf("Course: %s %s | Section #: %s | Professor: %s\nOpen Seats: %d | Waitlist Seats: %d\n\n",
	// 				m.Subject.ShortDesc, m.CatalogNumber, m.SectionNumber, m.Professor.Name.Last, m.EnrollmentStatus.OpenSeats, m.EnrollmentStatus.WaitlistOpenSpots)
	// 		}
	// 	}
	//}

	err = updateSeatInfoDB(conn, coursesSeatInfo)
	if err != nil {
		return fmt.Errorf ("Failed to update DB with course info: %w", err)
	}

	fmt.Println("Uploaded seat info to DB")

	return nil
}
