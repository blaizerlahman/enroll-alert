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
			prof_name, course_status, last_updated
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
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
			course_status       = EXCLUDED.course_status,
			last_updated        = CURRENT_TIMESTAMP;
	`

	var key string
	inserted := make(map[string]bool)

	for _, course := range coursesSeatInfo {
		for _, enrollmentPackage := range course.EnrollmentPackages {
			for _, section := range enrollmentPackage.Sections {

				key = fmt.Sprintf("%s-%s", section.CourseID, section.SectionNumber)
				if inserted[key] {
					continue
				}

				_, err := pool.Exec(context.Background(), query,
					TermNum, section.CourseID, section.SectionNumber, section.ClassType, section.Subject.SubjectID,
					fmt.Sprintf("%s %s", section.Subject.ShortDesc, section.CatalogNumber),
					course.CourseTitle, section.EnrollmentStatus.Capacity,
					section.EnrollmentStatus.CurrentlyEnrolled, section.EnrollmentStatus.OpenSeats,
					section.EnrollmentStatus.WaitlistCapacity, section.EnrollmentStatus.WaitlistOpenSpots,
					fmt.Sprintf("%s %s", section.Professor.Name.First, section.Professor.Name.Last),
					section.Status,
				)

				if err != nil {
					return fmt.Errorf("Failed to insert section %s course %s: %w",
						section.SectionNumber, section.CourseID, err)
				}

				// fetch course_name and course_title from courses table and update course_sections
				var courseName string
				var courseTitle string
				err = pool.QueryRow(context.Background(),
					`SELECT course_name, course_title FROM public.courses WHERE course_id = $1 AND term = $2 LIMIT 1`,
					section.CourseID, TermNum).Scan(&courseName, &courseTitle)
				if err != nil {
					log.Printf("Could not find course row for course_id=%s term=%d: %v", section.CourseID, TermNum, err)
				} else {
					_, err = pool.Exec(context.Background(),
						`UPDATE course_sections SET course_name = $1, course_title = $2 WHERE course_id = $3 AND section_num = $4 AND term = $5`,
						courseName, courseTitle, section.CourseID, section.SectionNumber, TermNum)
					if err != nil {
						log.Printf("Failed to update course_sections names/status for %s %s: %v", section.CourseID, section.SectionNumber, err)
					}
					_, err = pool.Exec(context.Background(),
						`UPDATE public.courses SET status = $1 WHERE course_id = $2 AND term = $3`,
						section.Status, section.CourseID, TermNum)
					if err != nil {
						log.Printf("Failed to update public.courses status for %s: %v", section.CourseID, err)
					}
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
	coursesQuery, err := enrollalertquery.QueryRecentChanges(20, Term)
	if err != nil {
		return fmt.Errorf("Failed to query for recent course changes")
	}

	var coursesSeatInfo []*Course
	for _, queryCourse := range coursesQuery {
		course := &Course{
			EnrollmentPackages: make([]*EnrollmentPackage, 0, len(queryCourse.EnrollmentPackages)),
			CourseTitle:        queryCourse.CourseTitle,
		}
		for _, queryPkg := range queryCourse.EnrollmentPackages {
			pkg := &EnrollmentPackage{Sections: make([]Section, 0, len(queryPkg.Sections))}
			for _, querySection := range queryPkg.Sections {
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
				if querySection.EnrollmentStatus != nil {
					sec.EnrollmentStatus.Capacity = querySection.EnrollmentStatus.Capacity
					sec.EnrollmentStatus.CurrentlyEnrolled = querySection.EnrollmentStatus.CurrentlyEnrolled
					sec.EnrollmentStatus.OpenSeats = querySection.EnrollmentStatus.OpenSeats
					sec.EnrollmentStatus.WaitlistOpenSpots = querySection.EnrollmentStatus.WaitlistCurrentSize
					sec.EnrollmentStatus.WaitlistCapacity = querySection.EnrollmentStatus.WaitlistCapacity
				}
				pkg.Sections = append(pkg.Sections, sec)
				//fmt.Printf("Processing section:\nCourse ID: %s, Catalog Number: %s, Section Number: %s\nClass Type: %s, Short Desc: %s, Professor Name: %s\n", sec.CourseID, sec.CatalogNumber, sec.SectionNumber, sec.ClassType, sec.Subject.ShortDesc, sec.Professor.Name.Last)
			}
			course.EnrollmentPackages = append(course.EnrollmentPackages, pkg)
		}
		coursesSeatInfo = append(coursesSeatInfo, course)
	}

	// update seat info in DB
	if err := updateSeatInfoDB(pool, coursesSeatInfo); err != nil {
		return fmt.Errorf("Failed to update DB with course info: %w", err)
	}

	log.Println("Uploaded seat info to DB")

	return nil
}
