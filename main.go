package main

func main() {

	connect()

	coursePackages := courseSubjectCodeScrape("1262", []string{"COMP SCI 354", "MATH 240"})

	var subjectCodes []string
	var courseCodes  []string
	for _, coursePackage := range coursePackages {
		subjectCodes = append(subjectCodes, coursePackage.Subject.SubjectCode)
		courseCodes  = append(courseCodes, coursePackage.CourseCode)
	}

	courseInfoScrape("1262", subjectCodes, courseCodes)
}
