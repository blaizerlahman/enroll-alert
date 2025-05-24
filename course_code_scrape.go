package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"
	"github.com/corpix/uarand"
)

// structure of each course package returned by API
type CoursePackage struct {
	CourseCode  string  `json:"courseID"`
	CatalogNum  string  `json:"catalogNumber"`

	// structure of subject section
	Subject struct {
		SubjectCode  string `json:"subjectCode"`
		ShortDesc    string `json:"shortDescription"`
	} `json:"subject"`
} 

// structure of overall response
type CourseResponse struct {
	Hits []CoursePackage  `json:"hits"`
}

// getReferrer appends course page URL with encoded course name 
// returns encoded course page URL to use as referrer
func getReferrer(term string, courseName string) string {

	base := fmt.Sprintf("https://public.enroll.wisc.edu/search?term=%s&keywords=", term)

	// URL encoding the given course name
	courseNameSplit := strings.Split(courseName, " ")
	keywords := strings.Join(courseNameSplit, "%20")

	return base + keywords
}

// getCourseSubjectCode retrieves course and subject codes from UW course enrollment API
// returns CoursePackage containing the course and subject code for a given class, nil if error
func getCourseSubjectCode(term string, courseName string) (*CoursePackage, error) {	

	// create payload body
	payload := map[string]interface{}{
		"selectedTerm": term,
		"queryString":  courseName,
		"page":         1,
		"pageSize":     5,
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

	url := "https://public.enroll.wisc.edu/api/search/v1"

	// create POST request with course search URL
	request, err := http.NewRequest("POST", url, bytes.NewBuffer(reqBody))
	if err != nil {
		fmt.Printf("Error while creating POST request: %s\n", err)
		return nil, err
	}

	// generate random user-agent
	userAgent := uarand.GetRandom()

	// set headers with random user-agent and modified referer with term/course name
	request.Header.Set("User-Agent", userAgent)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Origin", "https://public.enroll.wisc.edu")
	request.Header.Set("Referer", getReferrer(term, courseName))

	client := &http.Client{}

	fmt.Println("Sending request for:", courseName)

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

	// find course that matches the course we're looking for (should usually be first one)
	var targetCourse CoursePackage
	found := false

	for _, course := range hits {

		// set target course and stop early if found
		if (course.Subject.ShortDesc + " " + course.CatalogNum) == courseName {
			targetCourse = course
			found = true
			break
		}
	}

	if !found {
		fmt.Printf("Target course %s not found\n", courseName)
	}

	return &targetCourse, nil
}

// courseSubjectCodeScrape scrapes subject and course code for specified courses in the given term
// returns a list of CoursePackages containing course/subject codes
func courseSubjectCodeScrape(term string, courses []string) []*CoursePackage {
	
	if len(courses) == 0 {
		fmt.Println("No courses to search. Exiting.")
		return nil
	}

	// retrieve course codes 
	var coursePackages []*CoursePackage
	for _, courseName := range courses {
		currCourse, err := getCourseSubjectCode(term, courseName)
		if err != nil {
			fmt.Printf("Unable to get info for %s\n", courseName)
		} else {
			coursePackages = append(coursePackages, currCourse)
		}
	}

	return coursePackages
}

