package main

import (
	"flag"
	"fmt"
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
	flag.Parse()

	// set term number
	enrollalert.TermNum = *termFlag
  enrollalert.Term    = fmt.Sprintf("%d", enrollalert.TermNum)

	// conduct initial course load if specified
	if *initial {
		if err := enrollalert.InitialDriver(*countFlag); err != nil {
			fmt.Printf("Error during initial load: %v\n", err)
		} 
		return
	}
	
	// perform Postgres DB connection
	pool, err := pgxpool.New(context.Background(), os.Getenv("POSTGRES_URL"))
	if err != nil {
		fmt.Printf("Failed to connect to DB: %v\n", err)
		return
	}
	defer pool.Close()

	fmt.Println("Connected from main")

	// get course ids from existing courses table
	courseIDs, err := enrollalert.GetAllCourseIDs(pool)
	
	start := time.Now()

	// conduct course section info update
	err = enrollalert.CourseInfoUpdateDriver(pool, courseIDs)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	}

	elapsed := time.Since(start)
	fmt.Printf("Scraper done in %s\n", elapsed)


}
