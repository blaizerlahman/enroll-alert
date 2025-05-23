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

// getReferrer appends course page URL with encoded course name 
func getReferrer(term string, courseName string) string {

	base := fmt.Sprintf("https://public.enroll.wisc.edu/search?term=%s&keywords=", term)

	// URL encoding the given course name
	courseNameSplit := strings.Split(courseName, " ")
	keywords := strings.Join(courseNameSplit, "%20")

	return base + keywords
}

func checkClassStatus(term string, courseName string) string {	

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
		//return nil
	}

	url := "https://public.enroll.wisc.edu/api/search/v1"

	// create GET request with course search URL
	request, err := http.NewRequest("POST", url, bytes.NewBuffer(reqBody))
	if err != nil {
		fmt.Printf("Error while creating POST request: %s\n", err)
		//return nil
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
		//return nil
	}
	defer response.Body.Close()

	// read json response
	respBody, _ := ioutil.ReadAll(response.Body)
	fmt.Println("Response body:\n", string(respBody))

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		fmt.Printf("Error with json unmarshal: %s\n", err)
		//return nil
	}

// 	hits, ok := result["hits"].([]interface{})
// 	if !ok || len(hits) == 0 {
// 		return false, nil
// 	}
//
// 	for _, hit := range hits {
// 		hitMap := hit.(map[string]interface{})
// 		if hitMap["courseDesignation"] == courseName {
// 			prereqs := hitMap["enrollmentPrerequisites"]
// 			if prereqs != nil && strings.Contains(fmt.Sprint(prereqs), "Capstone Certificate") {
// 				return false, nil
// 			}
// 			return true, nil
// 		}
//
// }
	return "yes"
}

func newScrape(term string, courses []string) {
	
	for _, course := range courses {
		found := checkClassStatus(term, course)
		fmt.Println(found)
	}
}

