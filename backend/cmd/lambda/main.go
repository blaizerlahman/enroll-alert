package main

import (
	"context"
	"enroll-alert/enrollalert"
	"flag"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	initFlag      = flag.Bool("init", false, "")
	countFlag     = flag.Int("count", 5666, "")
	termFlag      = flag.Int("term", 1264, "")
	batchSizeFlag = flag.Int("batchsize", 50, "")
	delayTimeFlag = flag.Int("delay", 10, "")
	parseOnce     sync.Once
)

type Config struct {
	init        bool
	count       int
	term        int
	batchSize   int
	delayTime   int
	postgresURL string
}

// envBool Parse boolean flag for given input.
// Return input boolean or default if no given input.
func envBool(search string, defaultFlag bool) bool {
	if flag, ok := os.LookupEnv(search); ok {
		boolFlag, _ := strconv.ParseBool(flag)
		return boolFlag
	}
	return defaultFlag
}

// envInt Parse integer flag for given input.
// Return input integer or default if no given input
func envInt(search string, defaultFlag int) int {
	if flag, ok := os.LookupEnv(search); ok {
		intFlag, _ := strconv.Atoi(flag)
		return intFlag
	}
	return defaultFlag
}

// loadConfig Parse input flags and load DB URL.
// Return config object containing flags and DB URL.
func loadConfig() Config {
	parseOnce.Do(flag.Parse)
	return Config{
		init:        envBool("INIT", *initFlag),
		count:       envInt("COUNT", *countFlag),
		term:        envInt("TERM", *termFlag),
		batchSize:   envInt("BATCHSIZE", *batchSizeFlag),
		delayTime:   envInt("DELAYTIME", *delayTimeFlag),
		postgresURL: os.Getenv("POSTGRES_URL"),
	}
}

// run Runs all scraping functions including retrieving course IDs, scraping course data from
// UW-Madison Course Search & Enroll API, updating DB with new course info, and emailing users
// if new course info satisfies their conditions for an alert.
// Return error if error encountered during scraping
func run(ctx context.Context, config Config) error {
	enrollalert.TermNum = config.term
	enrollalert.Term = strconv.Itoa(config.term)

	// run initial DB loading if specified
	if config.init {
		return enrollalert.InitialDriver(config.count)
	}

	// establish DB connection
	pool, err := pgxpool.New(ctx, config.postgresURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	// scrape API for course section info and update DB
	if err := enrollalert.CourseInfoUpdateDriver(pool); err != nil {
		return err
	}

	// create SES email client
	mail, err := enrollalert.NewEmailClient(ctx, os.Getenv("EMAIL_FROM"), os.Getenv("ALERT_TEMPLATE"))
	if err != nil {
		return err
	}

	// send alert emails to users
	err = enrollalert.NotifyMatchingAlerts(ctx, pool, mail, enrollalert.TermNum)
	if err != nil {
		return err
	}

	// check if we need to run daily log aggregation
	needAggregate, err := enrollalert.CheckAggregate(ctx, pool)
	if err != nil {
		return err
	}

	// run log aggregation if so
	if needAggregate == true {
		return enrollalert.AggregateLogs(ctx, pool)
	}

	return nil
}

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

// handler Handler for scraping driver.
// Return error if error with scraping.
func handler(ctx context.Context) error {

	// checks IP of lambda function
	ip, err := getOutboundIP(ctx)
	if err != nil {
		log.Printf("failed to determine outbound IP: %v", err)
	} else {
		log.Printf("outbound IP: %s", ip)
	}

	return run(ctx, loadConfig())
}

// main Main function for AWS Lambda
func main() {

	if os.Getenv("AWS_LAMBDA_FUNCTION_NAME") != "" {
		timeStart := time.Now()
		lambda.Start(handler)
		log.Printf("Course updating done in %s", time.Since(timeStart))
		return
	}
	if err := run(context.Background(), loadConfig()); err != nil {
		log.Fatal(err)
	}
}
