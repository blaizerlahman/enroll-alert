package main

import (
    "log"
    "os"
)

func init() {

		// create log for scraping process
    logFile, err := os.OpenFile("scraper.log",
        os.O_CREATE|os.O_APPEND|os.O_WRONLY,
        0644,
    )
    if err != nil {
        log.Fatalf("Could not open log file: %v", err)
    }

    log.SetOutput(logFile)
    log.SetFlags(log.LstdFlags | log.Lmicroseconds)
}

