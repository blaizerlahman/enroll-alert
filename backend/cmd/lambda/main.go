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
	"strings"
	"errors"
	"fmt"
	"time"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultInit   	 = false
	defaultCount  	 = 5666
	defaultTerms  	 = "1266,1272"
	defaultBatchSize = 50
	defaultDelayTime = 10
)

var (
	initFlag      = flag.Bool("init", defaultInit, "")
	countFlag     = flag.Int("count", defaultCount, "")
	termsFlag     = flag.String("terms", defaultTerms, "")
	batchSizeFlag = flag.Int("batchsize", defaultBatchSize, "")
	delayTimeFlag = flag.Int("delay", defaultDelayTime, "")
	parseOnce     sync.Once
)

type Config struct {
	init        bool
	count       int
	terms       []int
	batchSize   int
	delayTime   int
	postgresURL string
}

// envBool Parse boolean env variable for given input.
// Return input boolean or default if no given input.
func envBool(search string, defaultFlag bool) bool {

	if flag, ok := os.LookupEnv(search); ok {
		boolFlag, _ := strconv.ParseBool(flag)
		return boolFlag
	}
	return defaultFlag
}

// envInt Parse integer env variable for given input.
// Return input integer or default if no given input
func envInt(search string, defaultFlag int) int {

	if flag, ok := os.LookupEnv(search); ok {
		intFlag, _ := strconv.Atoi(flag)
		return intFlag
	}
	return defaultFlag
}

// envString Parse string env variable for given input.
// Return input string or default if no given input
func envString(search string, defaultFlag string) string {
	
	if flag, ok := os.LookupEnv(search); ok && (flag != "") {
		return flag
	}
	return defaultFlag
}

// parseTerms Parses a comma-separated string of term numbers into a slice of ints.
// Return A slice of input term ints or empty list if parse fails
func parseTerms(terms string) []int {

	var termInts []int
	for _, part := range strings.Split(terms, ",") {
		term, err := strconv.Atoi(strings.TrimSpace(part))
		if err != nil {
			continue
		}
		termInts = append(termInts, term)
	}

	return termInts
}

// loadConfig Parse input flags and load DB URL.
// Return config object containing flags and DB URL.
func loadConfig() Config {

	parseOnce.Do(flag.Parse)

	var parsedTermsFlag []int

	// parse terms, resort to default if parsing fails
	parsedTermsFlag = parseTerms(envString("TERMS", *termsFlag))
	if len(parsedTermsFlag) == 0 {
		parsedTermsFlag = parseTerms(defaultTerms)
	}

	return Config{
		init:        envBool("INIT", *initFlag),
		count:       envInt("COUNT", *countFlag),
		terms:       parsedTermsFlag,
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

	// run initial DB loading if specified
	if config.init {
		for _, term := range config.terms {
			err := enrollalert.InitialDriver(config.count, term)
			if err != nil {
				log.Fatal(err)
			}
		}

		return nil
	}

	// establish DB connection
	pool, err := pgxpool.New(ctx, config.postgresURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	// create SES email client
	mail, err := enrollalert.NewEmailClient(ctx, os.Getenv("EMAIL_FROM"), os.Getenv("ALERT_TEMPLATE"))
	if err != nil {
		return err
	}

	var (
		wg sync.WaitGroup
		mu sync.Mutex
		errs []error
	)

	// concurrently run a goroutine for each term scrape
	for _, term := range config.terms {

		wg.Add(1)
		go func() {

			defer wg.Done()

			// scrape API for course section info and update DB
			if err := enrollalert.CourseInfoUpdateDriver(pool, term); err != nil {
				mu.Lock()
				errs = append(errs, fmt.Errorf("TERM: %d UPDATE: %w", term, err))
				mu.Unlock()
				return
			}


			// send alert emails to users
			err := enrollalert.NotifyMatchingAlerts(ctx, pool, mail, term)
			if err != nil {
				mu.Lock()
				errs = append(errs, fmt.Errorf("TERM: %d NOTIFY: %w", term, err))
				mu.Unlock()
				return
			}
		}()
	}

	wg.Wait()

	if len(errs) != 0 {
		return errors.Join(errs...)
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
