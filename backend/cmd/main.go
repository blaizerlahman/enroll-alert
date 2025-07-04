package main

import (
	"flag"
	"fmt"
	"log"
	"time"
	"context"
	"os"
	"enroll-alert/enrollalert"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {

	// check for init and count flag to conduct initial load (default is no initial load)
	initialFlag := flag.Bool("init", false, "run initial course loading")
	countFlag   := flag.Int("count", 5666, "number of courses to initially load")

	// check for term number (Fall 2025 as default)
	termFlag    := flag.Int("term", 1262, "term number to load courses for")

	// check for batch size (100 as deafult)
	batchSize   := flag.Int("batchsize", 100, "batch size of API calls")
	
	flag.Parse()

	// set term number
	enrollalert.TermNum = *termFlag
  enrollalert.Term    = fmt.Sprintf("%d", enrollalert.TermNum)

	log.Printf("Startup: init=%t, count=%d, term=%d",
		*initialFlag, *countFlag, *termFlag)

	timeStart := time.Now()

	// conduct initial course load if specified
	if *initialFlag {
		if err := enrollalert.InitialDriver(*countFlag); err != nil {
			log.Fatalf("Error during initial load: %v", err)
		} 

		log.Printf("Initial load successful (%s)", time.Since(timeStart))
		return
	}
	
	// perform Postgres DB connection
	pool, err := pgxpool.New(context.Background(), os.Getenv("POSTGRES_URL"))
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	} 
	defer pool.Close()

	// get course ids from existing courses table
	courseIDs, err := enrollalert.GetAllCourseIDs(pool)
	if err != nil {
		log.Fatalf("Error during course ID retrieval: %v", err)
	}

	log.Printf("Course ID retrieval successful.")
	
	// conduct course section info update
	err = enrollalert.CourseInfoUpdateDriver(pool, courseIDs, *batchSize)
	if err != nil {
		log.Fatalf("Error with course section info update: %v", err)
	} 

	// create email clients 
	mail, err := enrollalert.NewEmailClient(context.Background(), os.Getenv("EMAIL_FROM"))
	if err != nil {
		log.Fatalf("Error with email client creation: %v", err)
	}

	// send alert emails for sections that now match alerts
	if err := enrollalert.NotifyMatchingAlerts(context.Background(), pool, mail, enrollalert.TermNum); err != nil {
		log.Printf("Error with alert email sending: %v", err)
	}

	log.Printf("Course section info update successful.")
	
	log.Printf("Course updating done in %s", time.Since(timeStart))

	log.Printf("Course scrape and info update successful.")

}
