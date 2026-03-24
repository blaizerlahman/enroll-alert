package main

import (
	"context"
	"enroll-alert/enrollalert"
	"errors"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"strings"
	"strconv"
	"sync"
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

func main() {
	initialFlag := flag.Bool("init", false, "run initial course loading")
	countFlag   := flag.Int("count", 5666, "number of courses to initially load")
	termsFlag   := flag.String("terms", "1266,1272", "comma-separated term numbers to load courses for")
	flag.Parse()

	terms := parseTerms(*termsFlag)
	if len(terms) == 0 {
		log.Fatalf("No valid terms parsed from: %s", *termsFlag)
	}

	log.Printf("Startup: init=%t, count=%d, terms=%v", *initialFlag, *countFlag, terms)

	ip, err := getOutboundIP(context.Background())
	if err != nil {
		log.Printf("Failed to determine outbound IP: %v", err)
	} else {
		log.Printf("Outbound IP: %s", ip)
	}

	timeStart := time.Now()

	// conduct initial course load if specified
	if *initialFlag {
		for _, term := range terms {
			if err := enrollalert.InitialDriver(*countFlag, term); err != nil {
				log.Fatalf("Error during initial load for term %d: %v", term, err)
			}
			log.Printf("Initial load for term %d successful (%s)", term, time.Since(timeStart))
		}
		return
	}

	// perform Postgres DB connection
	pool, err := pgxpool.New(context.Background(), os.Getenv("POSTGRES_URL"))
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}
	defer pool.Close()

	// create email client
	mail, err := enrollalert.NewEmailClient(context.Background(), os.Getenv("EMAIL_FROM"), os.Getenv("ALERT_TEMPLATE"))
	if err != nil {
		log.Fatalf("Error with email client creation: %v", err)
	}

	var (
		wg   sync.WaitGroup
		mu   sync.Mutex
		errs []error
	)

	// concurrently run a goroutine for each term scrape
	for _, term := range terms {
		wg.Add(1)
		go func() {
			defer wg.Done()

			if err := enrollalert.CourseInfoUpdateDriver(pool, term); err != nil {
				mu.Lock()
				errs = append(errs, fmt.Errorf("term %d update: %w", term, err))
				mu.Unlock()
				return
			}
			log.Printf("Course section info update for term %d successful", term)

			if err := enrollalert.NotifyMatchingAlerts(context.Background(), pool, mail, term); err != nil {
				mu.Lock()
				errs = append(errs, fmt.Errorf("term %d notify: %w", term, err))
				mu.Unlock()
				return
			}
			log.Printf("Alert emails for term %d sent successfully", term)
		}()
	}

	wg.Wait()

	if err := errors.Join(errs...); err != nil {
		log.Fatalf("Errors during scrape: %v", err)
	}

	// check if we need to make aggregate logs
	needAggregate, err := enrollalert.CheckAggregate(context.Background(), pool)
	if err != nil {
		log.Printf("Error checking if log aggregation needed: %v", err)
	}

	if needAggregate {
		if err := enrollalert.AggregateLogs(context.Background(), pool); err != nil {
			log.Printf("Error aggregating logs: %v", err)
		}
	}

	log.Printf("Course updating done in %s", time.Since(timeStart))
}
