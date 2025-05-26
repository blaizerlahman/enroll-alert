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
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/corpix/uarand"
)

var Term string
var TermNum int

// initialCourseScrape creates and sends a POST request to UW Madison course
// search API and retrieves course/subject codes for given amount of courses
// returns a list of pointers to CoursePackages
func initialCourseScrape(totalCourses int) ([]*CoursePackage, error) {

	// create payload body
	payload := map[string]interface{}{
		"selectedTerm": Term,
		"queryString":  "*",
		"page":         1,
		"pageSize":     totalCourses,
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
		return nil, fmt.Errorf("Error with creating request reqBody: %w\n", err)
	}

	reqURL := "https://public.enroll.wisc.edu/api/search/v1"

	// create POST request with request URL
	request, err := http.NewRequest("POST", reqURL, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("Error while creating POST request: %w\n", err)
	}

	// generate random user-agent
	userAgent := uarand.GetRandom()

	referer := fmt.Sprintf("https://public.enroll.wisc.edu/search?term=%s&closed=true", Term)

  // set headers with random user-agent 
	request.Header.Set("User-Agent", userAgent)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Origin", "https://public.enroll.wisc.edu")
	request.Header.Set("Referer", referer) 

	client := &http.Client{}

	// send request and receive json response
	response, err := client.Do(request)
	if err != nil {
	  return nil, fmt.Errorf("Error sending request: %w\n", err)
	}
	defer response.Body.Close()

	// read json response
	respBody, _ := ioutil.ReadAll(response.Body)

	// parse and structure response as a list of CoursePackages
	var respStruct CourseResponse
	if err := json.Unmarshal(respBody, &respStruct); err != nil {
		return nil, fmt.Errorf("Error with json unmarshal: %w\n", err)
	}

	// extract hits
	hits := respStruct.Hits

	// create list of pointers to hit structs
	var hitPtrs []*CoursePackage
	for _, hit := range hits {
		hitPtrs = append(hitPtrs, &hit)
	}

	return hitPtrs, nil
}

// initialCourseLoad connects to Postgres database and inserts course/subject codes and
// course names pulled from CoursePackages into course table for given term 
// returns an error if database connection/insertion doesn't work
func initialCourseLoad(courses []*CoursePackage) error {

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
	var termNum     int
	
	// extract course info from each course and insert them into Postgres courses table
	for _, course := range courses {

		// create course name
		courseName = fmt.Sprintf("%s %s", course.Subject.ShortDesc, course.CatalogNum)


		subjectCode, err = strconv.Atoi(course.Subject.SubjectCode)
		if err != nil {
			log.Printf("Invalid subject code: '%s': %v", course.Subject.SubjectCode, err)
		}
		termNum, err = strconv.Atoi(Term)
		if err != nil {
			log.Printf("Invalid term: '%s': %v", Term, err)
		}

		// insert course/subject code and course name into database 
		_, err := pool.Exec(context.Background(), `
			INSERT INTO public.courses (course_id, subject_id, course_name, term)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (course_id, subject_id, term)
			DO UPDATE SET course_name = EXCLUDED.course_name
		`, course.CourseCode, subjectCode, courseName, termNum)

		if err != nil {
			return fmt.Errorf("Insert failed for following course: %s | Course ID: %s | Subject ID: %s | Term %s\nError: %w",
	courseName, course.CourseCode, course.Subject.SubjectCode, Term, err)
		}

	}
	
	fmt.Println("Courses successfully added to database")

	return nil
}

// initialDriver Driver for initial course scraping/loading, gets course information
// from initialCourseScrape and loads data into Postgres database with initialCourseLoad
// returns error if scraping or loading fails
func InitialDriver(totalCourses int) error {

	// get course info from scraping api
	courseCodes, err := initialCourseScrape(totalCourses)
	if err != nil {
		return fmt.Errorf("Error during initial scrape: %w", err)
	}
	
	// insert course data into database
	err = initialCourseLoad(courseCodes)
	if err != nil {
		return fmt.Errorf("Error during database insertion: %w", err)
	}

	return nil
}
