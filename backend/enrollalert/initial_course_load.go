package enrollalert

import (
	"os"
	"context"
	"fmt"
	"log"
	"bytes"
	"strconv"
	"encoding/json"
  "io/ioutil"
	"net/http"
	"time"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/corpix/uarand"
)

// search API returns at most this many hits per request regardless of requested pageSize
const initialPageSize = 500

// initialCourseScrape creates and sends POST requests to UW Madison course
// search API, paging through results, and retrieves course/subject codes for up to totalCourses courses
// returns a list of pointers to CoursePackages
func initialCourseScrape(totalCourses int, term int) ([]*CoursePackage, error) {

	termStr := strconv.Itoa(term)
	referer := fmt.Sprintf("https://public.enroll.wisc.edu/search?term=%s&closed=true", termStr)
	reqURL := "https://public.enroll.wisc.edu/api/search/v1"
	client := &http.Client{}

	var hitPtrs []*CoursePackage
	found := 0

	for page := 1; len(hitPtrs) < totalCourses; page++ {

		// create payload body
		payload := map[string]interface{}{
			"selectedTerm": termStr,
			"queryString":  "*",
			"page":         page,
			"pageSize":     initialPageSize,
			"sortOrder":    "SCORE",

			// filter to receive response with course id
			"filters": []interface{}{
				map[string]interface{}{
					"has_child": map[string]interface{}{
						"type":   "enrollmentPackage",
						"query": map[string]interface{}{
							"match_all": map[string]interface{}{},

		},},},},}

		// assmeble request body
		reqBody, err := json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("Error with creating request reqBody (page %d): %w\n", page, err)
		}

		// create POST request with request URL
		request, err := http.NewRequest("POST", reqURL, bytes.NewBuffer(reqBody))
		if err != nil {
			return nil, fmt.Errorf("Error while creating POST request (page %d): %w\n", page, err)
		}

		// set headers with random user-agent
		request.Header.Set("User-Agent", uarand.GetRandom())
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Accept", "application/json")
		request.Header.Set("Origin", "https://public.enroll.wisc.edu")
		request.Header.Set("Referer", referer)

		// send request and receive json response
		response, err := client.Do(request)
		if err != nil {
			return nil, fmt.Errorf("Error sending request (page %d): %w\n", page, err)
		}

		// read json response
		respBody, err := ioutil.ReadAll(response.Body)
		response.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("Error reading response (page %d): %w\n", page, err)
		}
		if response.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("Unexpected status %d (page %d): %s\n", response.StatusCode, page, string(respBody))
		}

		// parse and structure response as a list of CoursePackages
		var respStruct CourseResponse
		if err := json.Unmarshal(respBody, &respStruct); err != nil {
			return nil, fmt.Errorf("Error with json unmarshal (page %d): %w\n", page, err)
		}

		// create list of pointers to hit structs
		for i := range respStruct.Hits {
			hitPtrs = append(hitPtrs, &respStruct.Hits[i])
		}

		found = respStruct.Found
		log.Printf("Initial scrape page %d: %d courses (%d/%d found)", page, len(respStruct.Hits), len(hitPtrs), found)

		// stop once a short page comes back or all found courses have been retrieved
		if len(respStruct.Hits) < initialPageSize || len(hitPtrs) >= found {
			if len(hitPtrs) < found && len(hitPtrs) < totalCourses {
				log.Printf("WARNING: retrieved %d of %d found courses", len(hitPtrs), found)
			}
			break
		}

		// throttle between pages so as to not overload search API
		time.Sleep(3 * time.Second)
	}

	// trim to requested course count
	if found > totalCourses {
		log.Printf("WARNING: count %d is below %d courses found, only loading first %d (raise -count/COUNT)", totalCourses, found, totalCourses)
	}
	if len(hitPtrs) > totalCourses {
		hitPtrs = hitPtrs[:totalCourses]
	}

	return hitPtrs, nil
}

// initialCourseLoad connects to Postgres database and inserts course/subject codes and
// course names pulled from CoursePackages into course table for given term 
// returns an error if database connection/insertion doesn't work
func initialCourseLoad(courses []*CoursePackage, term int) error {

	termStr := strconv.Itoa(term)

	// opening connection
	connStr := os.Getenv("POSTGRES_URL")
	pool, err := pgxpool.New(context.Background(), connStr);

	if err != nil {
		return fmt.Errorf("Unable to connect: %w", err)
	}

	defer pool.Close()

	// set public search path to find courses table
	_, err = pool.Exec(context.Background(), "SET search_path TO public")
	if err != nil {
		return fmt.Errorf("Unable to set search_path: %w", err)
	}

	var courseName  string
	var subjectCode int
	
	// extract course info from each course and insert them into Postgres courses table
	for _, course := range courses {

		// create course name
		courseName = fmt.Sprintf("%s %s", course.Subject.ShortDesc, course.CatalogNum)


		subjectCode, err = strconv.Atoi(course.Subject.SubjectCode)
		if err != nil {
			log.Printf("Invalid subject code: '%s': %v", course.Subject.SubjectCode, err)
		}

		// insert course/subject code and course name into database 
		_, err := pool.Exec(context.Background(), `
			INSERT INTO public.courses (course_id, subject_id, course_name, course_title, term)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (course_id, term)
			DO UPDATE SET 
				course_name  = EXCLUDED.course_name,
				course_title = EXCLUDED.course_title,
				subjecT_id   = EXCLUDED.subject_id;
		`, course.CourseCode, subjectCode, courseName, course.CourseTitle, termStr)

		if err != nil {
			return fmt.Errorf("Insert failed for following course: %s | Course ID: %s | Subject ID: %s | Term %s\nError: %w",
				courseName, course.CourseCode, course.Subject.SubjectCode, termStr, err)
		}

		// insert course breadth description/code into breadth table for future querying
		for _, breadth := range course.BreadthSection {
    	_, err := pool.Exec(context.Background(), `
      	INSERT INTO course_breadths (course_id, term, breadth_code, breadth_description)
      	VALUES ($1, $2, $3, $4)
      	ON CONFLICT DO NOTHING;
    	`, course.CourseCode, term, breadth.BreadthCode, breadth.BreadthDescription)
			if err != nil {
				return fmt.Errorf("Insert for course breadth failed for the following course: %s\nBreadth: %s\n%w\n",
					courseName, breadth.BreadthDescription, err)
			}
		}
	}
	
	log.Println("Courses successfully added to database")

	return nil
}

// initialDriver Driver for initial course scraping/loading, gets course information
// from initialCourseScrape and loads data into Postgres database with initialCourseLoad
// returns error if scraping or loading fails
func InitialDriver(totalCourses int, term int) error {

	// get course info from scraping api
	courseCodes, err := initialCourseScrape(totalCourses, term)
	if err != nil {
		return fmt.Errorf("Error during initial scrape: %w", err)
	}
	
	// insert course data into database
	err = initialCourseLoad(courseCodes, term)
	if err != nil {
		return fmt.Errorf("Error during database insertion: %w", err)
	}

	return nil
}
