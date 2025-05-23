package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"github.com/corpix/uarand"
)

// structure of each section returned by API
type Section struct {
	SectionNumber	string `json:"sectionNumber"`

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
func getSectionInfo(term string, subject string, courseCode string) ([]*EnrollmentPackage, error) {

	url := fmt.Sprintf("https://public.enroll.wisc.edu/api/search/v1/enrollmentPackages/%s/%s/%s", term, subject, courseCode)

	// create GET request
	request, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Printf("Error while creating GET request: %s\n", err)
		return nil, err
	}

	// generate random user-agent 
	userAgent := uarand.GetRandom()

	// set headers with random user-agent and specified course term/subject
	request.Header.Set("User-Agent", userAgent)
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Origin", "https://public.enroll.wisc.edu")
	request.Header.Set("Referer", fmt.Sprintf("https://public.enroll.wisc.edu/search?term=%s&subject=%s", term, subject))

	client := &http.Client{}

	fmt.Println("Sending request for course code:", courseCode)

	// send request
	response, err := client.Do(request)
	if err != nil {
		fmt.Printf("Error sending request: %s\n", err)
		return nil, err
	}
	defer response.Body.Close()

	// read json response
	body, err := ioutil.ReadAll(response.Body)
	if err != nil {
		fmt.Printf("Error parsing response: %s\n", err)
		return nil, err
	}

	// parse and structure response as a list of EnrollmentPackages
	var sections []EnrollmentPackage
	if err := json.Unmarshal(body, &sections); err != nil {
		fmt.Printf("Error with json unmarshal: %s\n", err)
		return nil, err
	}

	if len(sections) == 0 {
		fmt.Printf("No sections found for course %s.\n\n", courseCode)
	}

	// print out section info for each section in the course 
	for _, section := range sections {
		fmt.Printf("Course Code: %s\n", courseCode)
		for _, section := range section.Sections {
			fmt.Println("Section:", section.SectionNumber)
			fmt.Printf("Professor: %s %s\n", section.Professor.Name.First, section.Professor.Name.Last)
			fmt.Printf("    Enrolled: %d/%d\n", section.EnrollmentStatus.CurrentlyEnrolled, section.EnrollmentStatus.Capacity)
			fmt.Printf("    Open Seats: %d\n", section.EnrollmentStatus.OpenSeats)
			fmt.Printf("    Waitlist Capacity: %d\n", section.EnrollmentStatus.WaitlistCapacity)
			fmt.Printf("    Waitlist spots: %d\n", section.EnrollmentStatus.WaitlistOpenSpots)
		}
	}
	
	// get pointers to each section
	var sectionPtrs []*EnrollmentPackage
	for i := range sections {
		sectionPtrs = append(sectionPtrs, &sections[i])
	}

	return sectionPtrs, nil
}

// courseInfoScrape gather course infromation for given courses and return them
func courseInfoScrape(term string, subjects []string, courseCodes []string) []*Course {

	var courses []*Course

	// get section info for each course from getSectionInfo
	for i, courseCode := range courseCodes {
		var course Course
		var err error
		course.EnrollmentPackages, err = getSectionInfo(term, subjects[i], courseCode)
		if err != nil {
			fmt.Printf("Error getting section info for %s: %v\n", courseCode, err)
		}
		courses = append(courses, &course)
	}

	return courses
}

