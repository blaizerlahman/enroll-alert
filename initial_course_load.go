package main

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
	"github.com/jackc/pgx/v5"
	"github.com/corpix/uarand"
)

// initialCourseScrape creates and sends a POST request to UW Madison course
// search API and retrieves course/subject codes for given amount of courses
// returns a list of pointers to CoursePackages
func initialCourseScrape(term string, totalCourses int) ([]*CoursePackage, error) {

	// create payload body
	payload := map[string]interface{}{
		"selectedTerm": term,
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
		fmt.Printf("Error with creating request reqBody: %s\n", err)
		return nil, err
	}

	reqURL := "https://public.enroll.wisc.edu/api/search/v1"

	// create POST request with request URL
	request, err := http.NewRequest("POST", reqURL, bytes.NewBuffer(reqBody))
	if err != nil {
		fmt.Printf("Error while creating POST request: %s\n", err)
		return nil, err
	}

	// generate random user-agent
	userAgent := uarand.GetRandom()

	referer := fmt.Sprintf("https://public.enroll.wisc.edu/search?term=%s&closed=true", term)

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
		fmt.Printf("Error sending request: %s\n", err)
		return nil, err
	}
	defer response.Body.Close()

	// read json response
	respBody, _ := ioutil.ReadAll(response.Body)

	// parse and structure response as a list of CoursePackages
	var respStruct CourseResponse
	if err := json.Unmarshal(respBody, &respStruct); err != nil {
		fmt.Printf("Error with json unmarshal: %s\n", err)
		return nil, err
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
func initialCourseLoad(term string, courses []*CoursePackage) error {

	// opening connection
	connStr := os.Getenv("POSTGRES_URL")
	conn, err := pgx.Connect(context.Background(), connStr);

	if err != nil {
		log.Fatal("Unable to connect: %v", err)
		return err
	}

	defer conn.Close(context.Background())

	// set public search path to find courses table
	_, err = conn.Exec(context.Background(), "SET search_path TO public")
	if err != nil {
		log.Fatal("Unable to set search_path:", err)
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
		termNum, err = strconv.Atoi(term)
		if err != nil {
			log.Printf("Invalid term: '%s': %v", term, err)
		}

		// insert course/subject code and course name into database 
		_, err := conn.Exec(context.Background(), `
			INSERT INTO public.courses (course_id, subject_id, course_name, term)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (course_id, subject_id, term)
			DO UPDATE SET course_name = EXCLUDED.course_name
		`, course.CourseCode, subjectCode, courseName, termNum)

		if err != nil {
			log.Fatalf("Insert failed for following course:  courseName=%s courseID=%d subjectID=%d term=%s\nError: %v",
	courseName, course.CourseCode, course.Subject.SubjectCode, term, err)
			return err
		}

	}
	
	fmt.Println("Courses successfully added to database")

	return nil
}

// initialDriver Driver for initial course scraping/loading, gets course information
// from initialCourseScrape and loads data into Postgres database with initialCourseLoad
// returns error if scraping or loading fails
func initialDriver(term string, totalCourses int) error {

	// get course info from scraping api
	courseCodes, err := initialCourseScrape(term, totalCourses)
	if err != nil {
		fmt.Printf("Error during initial scrape: %v", err)
		return err
	}
	
	// insert course data into database
	err = initialCourseLoad(term, courseCodes)
	if err != nil {
		fmt.Printf("Error during database insertion: %v", err)
	}

	return nil
}
