package enrollalert

import (
	"context"
	"fmt"
	"log"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CourseCodes struct {
	CourseID       string
	SubjectID      string
	CourseName     string
	CourseTitle    string
}

// getCourseCodesFromDB Queries course and subject codes using course name and creates a list of
// CourseCodes containing subject/course ID's and course name
// returns a list of pointers to CourseCodes containing course information
func getCourseCodesFromDB(pool *pgxpool.Pool, courseIDs []string) ([]*CourseCodes, error) {

	// perform query to retrieve course codes for specified courses and term
	rows, err := pool.Query(context.Background(), `
		SELECT DISTINCT ON (course_id) course_id, subject_id, course_name, course_title 
		FROM public.courses
		WHERE course_id = ANY($1)
		  AND term = $2;
	`, courseIDs, TermNum)
	if err != nil {
		return nil, fmt.Errorf("Error with course codes query: %w", err)
	}
	defer rows.Close()

	var queryResults []*CourseCodes

	// iterate through rows and create CourseCodes objects from data in rows
	for rows.Next() {
		currCourse := new(CourseCodes)
		if err := rows.Scan(&currCourse.CourseID, &currCourse.SubjectID, &currCourse.CourseName,
			&currCourse.CourseTitle); err != nil {
				return nil, fmt.Errorf("Error with row scan: %w", err)
		}
		queryResults = append(queryResults, currCourse)
	}

	if rows.Err() != nil {
		return nil, fmt.Errorf("Error with iteration: %w", rows.Err())
	}

	return queryResults, nil
}

func updateSeatInfoDB(pool *pgxpool.Pool, coursesSeatInfo []*Course) error {

	query := `
		INSERT INTO course_sections (
			term, course_id, section_num, section_type, subject_id, course_name, course_title,
			capacity, enrolled, open_seats, waitlist_capacity, waitlist_open_spots, 
			prof_name, last_updated
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
		ON CONFLICT (course_id, section_num)
		DO UPDATE SET
			section_type        = EXCLUDED.section_type,
			subject_id          = EXCLUDED.subject_id,
			course_name         = EXCLUDED.course_name,
			course_title        = EXCLUDED.course_title,
			capacity            = EXCLUDED.capacity,
			enrolled            = EXCLUDED.enrolled,
			open_seats          = EXCLUDED.open_seats,
			waitlist_capacity   = EXCLUDED.waitlist_capacity,
			waitlist_open_spots = EXCLUDED.waitlist_open_spots,
			prof_name           = EXCLUDED.prof_name,
			last_updated        = CURRENT_TIMESTAMP;
	`

	// create map to detect duplicates from scraper
	var key string
	inserted := make(map[string]bool)
	

	for _, course := range coursesSeatInfo {
		for _, enrollmentPackage := range course.EnrollmentPackages {
			for _, section := range enrollmentPackage.Sections {	
				
				// skip already inserted duplicates to avoid redundancy
				key = fmt.Sprintf("%s-%s", section.CourseID, section.SectionNumber)
				if inserted[key] {
					continue
				}

				// insert section info into database
				_, err := pool.Exec(context.Background(), query,

					TermNum, section.CourseID, section.SectionNumber, section.ClassType, section.Subject.SubjectID,
				  fmt.Sprintf("%s %s", section.Subject.ShortDesc, section.CatalogNumber), 
				  course.CourseTitle, section.EnrollmentStatus.Capacity, 
					section.EnrollmentStatus.CurrentlyEnrolled, section.EnrollmentStatus.OpenSeats, 
					section.EnrollmentStatus.WaitlistCapacity, section.EnrollmentStatus.WaitlistOpenSpots,
					fmt.Sprintf("%s %s", section.Professor.Name.First, section.Professor.Name.Last),
				)

				if err != nil {
					return fmt.Errorf("Failed to insert section %s course %s: %w",
						section.SectionNumber, section.CourseID, err)
				}

				inserted[key] = true
			}
		}
	}

	return nil
}

// CourseInfoUpdateDriver Retrieves course/subject ID from Postgres database and uses info to scrape
// course seat info from UW Madison enrollment API. Uses scraped data to update Postgres database for
// specified courses
// Returns error on failure
func CourseInfoUpdateDriver(pool *pgxpool.Pool, courseNames []string) error {

	// get course codes from database for specified courses
	courseCodes, err := getCourseCodesFromDB(pool, courseNames)
	if err != nil {
		return fmt.Errorf("Error with retrieving course info from database: %w", err)
	}

	coursesSeatInfo := courseInfoScrape(pool, courseCodes)

	err = updateSeatInfoDB(pool, coursesSeatInfo)
	if err != nil {
		return fmt.Errorf ("Failed to update DB with course info: %w", err)
	}

	log.Println("Uploaded seat info to DB")

	return nil
}
