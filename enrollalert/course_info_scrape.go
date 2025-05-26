package enrollalert

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"context"
	"net/http"
	"sync"
	"github.com/corpix/uarand"
	"github.com/jackc/pgx/v5/pgxpool"
)

// structure of each section returned by API
type Section struct {
	CourseID      string `json:"courseId`
	CatalogNumber string `json:"catalogNumber`
	SectionNumber	string `json:"sectionNumber"`
	ClassType     string `json:"type"`

	// structure of subject section
	Subject struct {
		SubjectID  int    `json:subjectCode`
		ShortDesc  string `json:"shortDescription"`
	} `json:"subject"`

	// structure of instructor section
	Professor struct {
		Name struct {
			First string `json:"first"`
			Last  string `json:"last"`
		} `json:"name"`
	} `json:"instructor"`
	
	// structure of enrollmentStatus section
	EnrollmentStatus struct {
		Capacity              int    `json:"capacity"`
		CurrentlyEnrolled     int    `json:"currentlyEnrolled"`
		OpenSeats             int    `json:"openSeats"`
		WaitlistOpenSpots     int    `json:"openWaitlistSpots"`
		WaitlistCapacity		  int    `json:"aggregateWaitlistCapacity`
	} `json:"enrollmentStatus`	
}

// overall response structure
type EnrollmentPackage struct {
	Sections []Section	`json:"sections"`
}

// hold all enrollment packages (sections) for a particular course
type Course struct {
	EnrollmentPackages []*EnrollmentPackage 
}

// getSectionInfo builds GET request and sends to and receives from API for specified course
// returns list of sections each with its own section info
func getSectionInfo(courseCodes *CourseCodes) ([]*EnrollmentPackage, error) {

	url := fmt.Sprintf("https://public.enroll.wisc.edu/api/search/v1/enrollmentPackages/%s/%s/%s", Term, courseCodes.SubjectID, courseCodes.CourseID)

	// create GET request
	request, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("Error while creating GET request: %w\n", err)
	}

	// generate random user-agent 
	userAgent := uarand.GetRandom()

	// set headers with random user-agent and specified course term/subject
	request.Header.Set("User-Agent", userAgent)
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Origin", "https://public.enroll.wisc.edu")
	request.Header.Set("Referer", fmt.Sprintf("https://public.enroll.wisc.edu/search?term=%s&subject=%s", Term, courseCodes.SubjectID))

	client := &http.Client{}

	// send request
	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("Error sending request: %w\n", err)
	}
	defer response.Body.Close()

	// read json response
	body, err := ioutil.ReadAll(response.Body)
	if err != nil {
		return nil, fmt.Errorf("Error parsing response: %w\n", err)
	}

	// parse and structure response as a list of EnrollmentPackages
	var sections []EnrollmentPackage
	if err := json.Unmarshal(body, &sections); err != nil {
		return nil, fmt.Errorf("Error with json unmarshal: %w\n", err)
	}

	if len(sections) == 0 {
		fmt.Printf("No sections found for course %s.\n\n", courseCodes.CourseName)
	}

	// get pointers to each section
	var sectionPtrs []*EnrollmentPackage
	for i := range sections {
		sectionPtrs = append(sectionPtrs, &sections[i])
	}

	return sectionPtrs, nil
} 

// markHasSectionInSectionCache Updates course cache table with if given course has a section
// or not so redundant scraping can be avoided
// Returns error if failure in updating table
func markHasSectionInSectionCache(pool *pgxpool.Pool, courseID string, hasSection bool) error {

	// update section cache table with if course has a section
	_, err := pool.Exec(context.Background(), `
		INSERT INTO course_section_cache (course_id, term, last_seen, has_section)
		VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
		ON CONFLICT (course_id)
		DO UPDATE SET last_seen = CURRENT_TIMESTAMP, has_section = $3;
	`, courseID, TermNum, hasSection)

	if err != nil {
		return fmt.Errorf("Error with updating section cache for %s: %w", courseID, err)
	}

	return nil
}

// courseInfoScrape gather course infromation for given courses and return them
func courseInfoScrape(pool *pgxpool.Pool, courseCodes []*CourseCodes) []*Course {

	var waitGroup  sync.WaitGroup
	var mutex      sync.Mutex
	var courses    []*Course
	var course     Course

	jobs := make(chan *CourseCodes, len(courseCodes))

	totalWorkers := 10
	for currWorker := 0; currWorker < totalWorkers; currWorker++ {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			for courseCode := range jobs {

				enrollmentPackages, err := getSectionInfo(courseCode)
				if err != nil {
					fmt.Printf("Error getting section info for %s: %v\n", courseCode.CourseID, err)
					continue
				}
				course.EnrollmentPackages = enrollmentPackages

				if len(enrollmentPackages) == 0 {
					err = markHasSectionInSectionCache(pool, courseCode.CourseID, false)
				} else {
					err = markHasSectionInSectionCache(pool, courseCode.CourseID, true)
				}

				if err != nil {
					fmt.Printf("Error updating cache for %s: %v\n", courseCode.CourseID, err)
				}

				mutex.Lock()
				courses = append(courses, &course)
				mutex.Unlock()
			}
		}()
	}

	for _, courseCode := range courseCodes {
		jobs <- courseCode
	}
	close(jobs)

	waitGroup.Wait()

	return courses
}
	
