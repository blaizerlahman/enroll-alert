package main

import (
	"fmt"
	"time"
	"strconv"
	"context"
	"os"
	"enroll-alert/enrollalert"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {

	var err1 error
	enrollalert.Term = "1262"
  enrollalert.TermNum, err1 = strconv.Atoi(enrollalert.Term)
	if err1 != nil {
		fmt.Printf("Error with converting term number: %v", err1)
	}
	//connect()

	//coursePackages := courseSubjectCodeScrape("1262", []string{"COMP SCI 354", "MATH 240"})

	//var subjectCodes []string
	//var courseCodes  []string
	//for _, coursePackage := range coursePackages {
		//subjectCodes = append(subjectCodes, coursePackage.Subject.SubjectCode)
		//courseCodes  = append(courseCodes, coursePackage.CourseCode)
	//}

	//courseInfoScrape("1262", subjectCodes, courseCodes)

	//enrollalert.InitialDriver(5666)
	
	pool, err := pgxpool.New(context.Background(), os.Getenv("POSTGRES_URL"))
	if err != nil {
		fmt.Printf("Failed to connect to DB: %v\n", err)
		return
	}
	defer pool.Close()

	fmt.Println("Connected from main")

	courseIDs, err := enrollalert.GetAllCourseIDs(pool)
	
	start := time.Now()

	err = enrollalert.CourseInfoUpdateDriver(pool, courseIDs)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	}

	elapsed := time.Since(start)
	fmt.Printf("Scraper done in %s\n", elapsed)


}
