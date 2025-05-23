package main

import (
	"fmt"
) 

func main() {

	connect()

	newScrape(1262, []string{"COMP SCI 300", "MATH 221"})

	courses := courseInfoScrape("1262", "266", []string{"024795"})
	for _, course := range courses {
		for _, enrollmentPackage := range course.EnrollmentPackages {
			for _, lecture := range enrollmentPackage.Sections {
				fmt.Println(lecture.Professor.Name.Last)
			}
		}
	}
}
