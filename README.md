# EnrollAlert

EnrollAlert is a website and notification service that tracks seat availability for UW-Madison courses and allows users to be notified the moment a seat opens up.

It is powered by a scheduled Go scraper that grabs real time course seat info which is made available on a React/Next.js frontend hosted with Vercel, which you can find at [enrollalert.com](https://enrollalert.com). Data is stored in a Supabase PostgreSQL database and project operations including emailing and automated scraping are supported by AWS services.

EnrollAlert is inspired by [Madgrades](https://madgrades.com/) and strives to make the course enrollment process easier and stress-free for UW-Madison students.

As of November 2025, a large refactor has been implemented which moved EnrollAlert onto using a private API. Because of this the current backend implementation is not available publicly. To see the previous backend version, refer to the instructions in **Local Development** and also check out the [deprecated README](deprecated-README.md) for a nice architectural diagram of it.

## Features
* **Real-time seat tracking**: Scrapes UW-Madison's Course Search & Enroll API on a configurable schedule and dynamically updates the course database.
* **Customizable alerts**: Allows users to specify when they would like to be notified of seat availability in specific courses **and** specific subsections.
* **Instant notifications**: Email (and in the future SMS) alerts are sent to users as soon as their selected alerts go off.
* **Filtered search**: Users can search for courses by name, subject, and the specific degree credits that they satisfy.
* **Course dashboard**: The **My Courses** page shows users' active alerts, seat info for selected courses, and allows for alert removal with the click of a button.
* **Account security**: Firebase authentication and Supabase Row-Level-Security protect user info and requests.

## Architecture
* **Scraper**: Go program that can be run via AWS Lambda `cmd/lambda/main.go` or locally `cmd/main.go`. On initial run it grabs course ID's from UW-Madison's general search API and uploads them to DB. On subsequent runs it queries a Course Search and Enroll API to retrieve course info from courses whose enrollment statuses have recently changed.

* **Notifier**: Go program run after scraper checks newly updated courses to see if any user alerts have been set off. Emails users via AWS SES and deletes alerts after notification.

* **Database**: PostgreSQL database hosted on Supabase. Contains course information (course ID's, subject ID's, breadths, etc.), course section information (enrollment status, professor, section number), and user information (specified course alerts).

* **Frontend**: Built with Next.js, React, and Typescript with Shadcn components, deployed via Vercel. Next.js API endpoints are called with user actions, retrieving from and updating PostgreSQL database. Firebase used for authentication.

## Local Development
**DISCLAIMER**: This project scrapes data from a public, university site whose purpose is to serve UW-Madison students. Please obtain permission before use and employ best practices. It remains available to be used as an educational tool so one can see how a scraper like this would be implemented.

A Dockerfile will be provided in future commits, but for now this serves as a somewhat simple guide to run the scraper locally.

Running the scraper locally can only work with the deprecated version, as now a private API is used. Refer to the version of the repository made prior to November 2025 (before integrate-queries branch was merged). To run the course scraper locally, `git clone` and spin up a PostgreSQL database and save the connection string as an environment variable `POSTGRES_URL`. Run `go build -o scraper backend/cmd/main.go` (not `backend/cmd/lambda/main.go`), and once built run `./scraper -init`. For subsequent runs, just do `./scraper`. Currently, the scraper is set to scrape **Fall 2025** courses by default, but term can be specified by running `./scraper -term <term-number>`, with the term number you want being found via the Course Search & Enroll API. If you've configured your `courses` and `course_sections` tables correctly, both should be populated with current course info.

## Contribution
Contributions are **welcome and encouraged**. Feel free to fork and open PR's as you please, any improvements will be greatly appreciated. If you want to make suggestions, feel free to open an issue or fill out the [feedback form on the site](https://form.jotform.com/251638644266161). Future updates and improvements are always in the works. Contributions made that support the Roadmap below are incredibly helpful!

## Roadmap
* Better UI support on mobile
* Persistent data storage and tracking to show past enrollment trends
* SMS notification options
* FAQ section once user feedback is gathered

## Developers
Developed by Blaize Lahman

## References
Course data gathered from [UW-Madison Course Search & Enroll](https://public.enroll.wisc.edu/search)

Project inspired by [Madgrades](https://github.com/Madgrades)

Project unaffiliated with the University of Wisconsin-Madison





 
