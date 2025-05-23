package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"strings"
	"github.com/corpix/uarand"
)

func getReferrer(courseName string) string {
	base := "https://public.enroll.wisc.edu/search?term=1244&keywords="
	courseNameSplit := strings.Split(courseName, " ")
	end := strings.Join(courseNameSplit, "%20")
	return base + end
}

func checkClassStatus(courseName string) (bool, error) {
	url := "https://public.enroll.wisc.edu/api/search/v1"

	payload := map[string]interface{}{
		"selectedTerm": "1262",
		"queryString":  courseName,
		"filters": []interface{}{
			map[string]interface{}{
				"has_child": map[string]interface{}{
					"type": "enrollmentPackage",
					"query": map[string]interface{}{
						"bool": map[string]interface{}{
							"must": []interface{}{
								map[string]interface{}{
									"match": map[string]interface{}{
										"packageEnrollmentStatus.status": "OPEN WAITLISTED",
									},
								},
								map[string]interface{}{
									"bool": map[string]interface{}{
										"should": []interface{}{
											map[string]interface{}{
												"bool": map[string]interface{}{
													"must_not": []interface{}{
														map[string]interface{}{
															"exists": map[string]interface{}{
																"field": "sections.classAttributes",
															},
														},
													},
												},
											},
											map[string]interface{}{
												"match": map[string]interface{}{
													"sections.classAttributes.attributeCode": "TEXT SVCL",
												},
											},
										},
									},
								},
								map[string]interface{}{
									"match": map[string]interface{}{
										"published": true,
									},
								},
							},
						},
					},
				},
			},
		},
		"page":      1,
		"pageSize":  1,
		"sortOrder": "SCORE",
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return false, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return false, err
	}

	userAgent := uarand.GetRandom()

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Referer", getReferrer(courseName))
	req.Header.Set("Origin", "https://public.enroll.wisc.edu")

	client := &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true}, // matches Python's verify=False
		},
	}

	fmt.Println("Sending request for", courseName)
	resp, err := client.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return false, err
	}

	hits, ok := result["hits"].([]interface{})
	if !ok || len(hits) == 0 {
		return false, nil
	}

	for _, hit := range hits {
		hitMap := hit.(map[string]interface{})
		if hitMap["courseDesignation"] == courseName {
			prereqs := hitMap["enrollmentPrerequisites"]
			if prereqs != nil && strings.Contains(fmt.Sprint(prereqs), "Capstone Certificate") {
				return false, nil
			}
			return true, nil
		}
	
}

	return false, nil
}

func newScrape(term int, courses []string) {
	
	for _, course := range courses {
		found, err := checkClassStatus(course)
		if err != nil {
			log.Printf("Error checking course %s: %v", course, err)
			continue
		}
		fmt.Printf("Course %s open/waitlisted: %v\n", course, found)
	}
}

