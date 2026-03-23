package enrollalert

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"github.com/blaizerlahman/enroll-alert-query/enrollalertquery"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CourseCodes struct {
	CourseID    string
	SubjectID   string
	CourseName  string
	CourseTitle string
}

func updateSeatInfoDB(pool *pgxpool.Pool, coursesSeatInfo []*Course, term int) error {

	query := `
		INSERT INTO course_sections (
			term, course_id, section_num, section_type, subject_id, course_name, course_title,
			capacity, enrolled, open_seats, waitlist_capacity, waitlist_open_spots, 
			prof_name, course_status, last_updated
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
		ON CONFLICT (term, course_id, section_num)
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
			course_status       = EXCLUDED.course_status,
			last_updated        = CURRENT_TIMESTAMP;
	`

	var key string
	inserted := make(map[string]bool)
	insertCount := 0
	updateCount := 0

	for _, course := range coursesSeatInfo {
		for _, enrollmentPackage := range course.EnrollmentPackages {
			for _, section := range enrollmentPackage.Sections {

				key = fmt.Sprintf("%s-%s", section.CourseID, section.SectionNumber)
				if inserted[key] {
					continue
				}

				// DEBUG: Log what we're about to insert for course 004287
				//if section.CourseID == "004287" {
				//	log.Printf("DEBUG: Attempting to insert course 004287 section %s", section.SectionNumber)
				//	log.Printf("  CourseID: %s", section.CourseID)
				//	log.Printf("  SectionNumber: %s", section.SectionNumber)
				//	log.Printf("  ClassType: %s", section.ClassType)
				//	log.Printf("  SubjectID: %d", section.Subject.SubjectID)
				//	log.Printf("  ShortDesc: '%s'", section.Subject.ShortDesc)
				//	log.Printf("  CatalogNumber: %s", section.CatalogNumber)
				//	log.Printf("  CourseTitle: '%s'", course.CourseTitle)
				//	log.Printf("  Professor: %s %s", section.Professor.Name.First, section.Professor.Name.Last)
				//	log.Printf("  Status: %s", section.Status)
				//	log.Printf("  EnrollmentStatus: Capacity=%d, Enrolled=%d, OpenSeats=%d",
				//		section.EnrollmentStatus.Capacity,
				//		section.EnrollmentStatus.CurrentlyEnrolled,
				//		section.EnrollmentStatus.OpenSeats)
				//}

				courseName := fmt.Sprintf("%s %s", section.Subject.ShortDesc, section.CatalogNumber)
				profName := fmt.Sprintf("%s %s", section.Professor.Name.First, section.Professor.Name.Last)

				result, err := pool.Exec(context.Background(), query,
					term,
					section.CourseID,
					section.SectionNumber,
					section.ClassType,
					section.Subject.SubjectID,
					courseName,
					course.CourseTitle,
					section.EnrollmentStatus.Capacity,
					section.EnrollmentStatus.CurrentlyEnrolled,
					section.EnrollmentStatus.OpenSeats,
					section.EnrollmentStatus.WaitlistCapacity,
					section.EnrollmentStatus.WaitlistOpenSpots,
					profName,
					section.Status,
				)

				if err != nil {
					log.Printf("ERROR: Failed to insert/update section %s course %s: %v",
						section.SectionNumber, section.CourseID, err)
					return fmt.Errorf("Failed to insert section %s course %s: %w",
						section.SectionNumber, section.CourseID, err)
				}

				rowsAffected := result.RowsAffected()
				//if section.CourseID == "004287" {
				//	log.Printf("DEBUG: Insert/update successful for 004287-%s, rows affected: %d",
				//		section.SectionNumber, rowsAffected)
				//}

				if rowsAffected > 0 {
					insertCount++
				} else {
					updateCount++
				}

				// fetch course_name and course_title from courses table and update course_sections
				var dbCourseName string
				var dbCourseTitle string
				err = pool.QueryRow(context.Background(),
					`SELECT course_name, course_title FROM public.courses WHERE course_id = $1 AND term = $2 LIMIT 1`,
					section.CourseID, term).Scan(&dbCourseName, &dbCourseTitle)
				if err != nil {
					log.Printf("Could not find course row for course_id=%s term=%d: %v", section.CourseID, term, err)
				} else {
					_, err = pool.Exec(context.Background(),
						`UPDATE course_sections SET course_name = $1, course_title = $2 WHERE course_id = $3 AND section_num = $4 AND term = $5`,
						dbCourseName, dbCourseTitle, section.CourseID, section.SectionNumber, term)
					if err != nil {
						log.Printf("Failed to update course_sections names/status for %s %s: %v", section.CourseID, section.SectionNumber, err)
					}
					_, err = pool.Exec(context.Background(),
						`UPDATE public.courses SET status = $1 WHERE course_id = $2 AND term = $3`,
						section.Status, section.CourseID, term)
					if err != nil {
						log.Printf("Failed to update public.courses status for %s: %v", section.CourseID, err)
					}
				}

				inserted[key] = true
			}
		}
	}

	log.Printf("Insert/Update summary: %d new inserts, %d updates", insertCount, updateCount)
	return nil
}

// CourseInfoUpdateDriver Scraper recent changes in course enrollment info from UW Madison enrollment API. Uses scraped data to update Postgres database for
// specified courses
// Returns error on failure
func CourseInfoUpdateDriver(pool *pgxpool.Pool, term int) error {

	termStr := strconv.Itoa(term)

	// query API for all recently changed courses in last 12 min
	coursesQuery, err := enrollalertquery.QueryRecentChanges(200, 12, termStr)
	if err != nil {
		return fmt.Errorf("Failed to query for recent course changes: %w", err)
	}

	log.Printf("DEBUG: Total courses retrieved from API: %d", len(coursesQuery))

	var coursesSeatInfo []*Course
	for _, queryCourse := range coursesQuery {
		course := &Course{
			EnrollmentPackages: make([]*EnrollmentPackage, 0, len(queryCourse.EnrollmentPackages)),
			CourseTitle:        queryCourse.CourseTitle,
		}
		for _, queryPkg := range queryCourse.EnrollmentPackages {
			pkg := &EnrollmentPackage{Sections: make([]Section, 0, len(queryPkg.Sections))}
			for _, querySection := range queryPkg.Sections {

				// DEBUG logging for course 004287
				//if querySection.CourseID == "004287" {
				//	log.Printf("DEBUG: Processing query section for 004287-%s", querySection.SectionNumber)
				//	log.Printf("  querySection.EnrollmentStatus nil? %v", querySection.EnrollmentStatus == nil)
				//	if querySection.EnrollmentStatus != nil {
				//		log.Printf("  querySection capacity: %d", querySection.EnrollmentStatus.Capacity)
				//	}
				//}

				sec := Section{
					CourseID:      querySection.CourseID,
					CatalogNumber: querySection.CatalogNumber,
					SectionNumber: querySection.SectionNumber,
					ClassType:     querySection.ClassType,
					Status:        querySection.Status,
				}
				sec.Subject.SubjectID = querySection.Subject.SubjectID
				sec.Subject.ShortDesc = querySection.Subject.ShortDesc
				sec.Professor.Name.First = querySection.Professor.Name.First
				sec.Professor.Name.Last = querySection.Professor.Name.Last

				// copy enrollment data if present
				if querySection.EnrollmentStatus != nil {
					sec.EnrollmentStatus.Capacity = querySection.EnrollmentStatus.Capacity
					sec.EnrollmentStatus.CurrentlyEnrolled = querySection.EnrollmentStatus.CurrentlyEnrolled
					sec.EnrollmentStatus.OpenSeats = querySection.EnrollmentStatus.OpenSeats
					sec.EnrollmentStatus.WaitlistOpenSpots = querySection.EnrollmentStatus.WaitlistCurrentSize
					sec.EnrollmentStatus.WaitlistCapacity = querySection.EnrollmentStatus.WaitlistCapacity
				} else {
					log.Printf("WARNING: No enrollment status for section %s-%s",
						querySection.CourseID, querySection.SectionNumber)
				}

				pkg.Sections = append(pkg.Sections, sec)
			}
			course.EnrollmentPackages = append(course.EnrollmentPackages, pkg)
		}
		coursesSeatInfo = append(coursesSeatInfo, course)
	}

	log.Printf("DEBUG: Total sections to insert/update: %d", len(coursesSeatInfo))

	// update seat info in DB
	if err := updateSeatInfoDB(pool, coursesSeatInfo, term); err != nil {
		return fmt.Errorf("Failed to update DB with course info: %w", err)
	}

	log.Println("Uploaded seat info to DB")

	return nil
}
