package enrollalert

import (
	"context"
	"fmt"
	"log"

	"github.com/blaizerlahman/enroll-alert-query/enrollalertquery"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CourseCodes struct {
	CourseID    string
	SubjectID   string
	CourseName  string
	CourseTitle string
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
func CourseInfoUpdateDriver(pool *pgxpool.Pool) error {

	// get course codes from database for specified courses
	//courseCodes, err := getCourseCodesFromDB(pool, courseNames)
	//if err != nil {
	//	return fmt.Errorf("Error with retrieving course info from database: %w", err)
	//}

	//// batch course IDs
	//batches := batchCourseIDs(courseCodes, batchSize)

	//delay := time.Duration(delayTime) * time.Second

	//// perform API scrape and DB upload in batches
	//for i, courseIDBatch:= range batches {

	//	coursesSeatInfo := courseInfoScrape(pool, courseIDBatch)

	//	err = updateSeatInfoDB(pool, coursesSeatInfo)
	//	if err != nil {
	//		return fmt.Errorf ("Failed to update DB with course info: %w", err)
	//	}

	//	// delay next batch
	//	if i < len(batches) - 1 {
	//		time.Sleep(delay)
	//	}
	//}

	// query API for all recently changed courses
	if coursesSeatInfo, err := enrollalertquery.QueryRecentChanges(20, Term); err != nil {
		return fmt.Errorf("Failed to query for recent course changes")
	}

	// update seat info in DB
	if err := updateSeatInfoDB(pool, coursesSeatInfo); err != nil {
		return fmt.Errorf("Failed to update DB with course info: %w", err)
	}

	log.Println("Uploaded seat info to DB")

	return nil
}
