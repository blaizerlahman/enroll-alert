package main

import (
	"context"
	"enroll-alert/enrollalert"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func getOutboundIP(ctx context.Context) (string, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.ipify.org", nil)
	if err != nil {
		return "", err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func main() {

	// check for init and count flag to conduct initial load (default is no initial load)
	initialFlag := flag.Bool("init", false, "run initial course loading")
	countFlag := flag.Int("count", 5666, "number of courses to initially load")

	// check for term number (Spring 2026 as default)
	termFlag := flag.Int("term", 1264, "term number to load courses for")

	// check for batch size (100 as default)
	//batchSize := flag.Int("batchsize", 100, "batch size of API calls")

	flag.Parse()

	// set term number
	enrollalert.TermNum = *termFlag
	enrollalert.Term = fmt.Sprintf("%d", enrollalert.TermNum)

	log.Printf("Startup: init=%t, count=%d, term=%d", *initialFlag, *countFlag, *termFlag)

	// checks IP of lambda function
	ip, err := getOutboundIP(context.Background())
	if err != nil {
		log.Printf("failed to determine outbound IP: %v", err)
	} else {
		log.Printf("outbound IP: %s", ip)
	}

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
	//courseIDs, err := enrollalert.GetAllCourseIDs(pool)
	//if err != nil {
	//	log.Fatalf("Error during course ID retrieval: %v", err)
	//}

	//log.Printf("Course ID retrieval successful.")

	// conduct course section info update
	err = enrollalert.CourseInfoUpdateDriver(pool)
	if err != nil {
		log.Fatalf("Error with course section info update: %v", err)
	}

	// create email clients
	mail, err := enrollalert.NewEmailClient(context.Background(), os.Getenv("EMAIL_FROM"), os.Getenv("ALERT_TEMPLATE"))
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
