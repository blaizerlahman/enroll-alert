package enrollalert

import (
	"fmt"
	"context"
	"github.com/jackc/pgx/v5"
)

// GetAllCourseNames Queries courses table for all unique course names.
// Returns list of course names or error if failure
func GetAllCourseNames(conn *pgx.Conn) ([]string, error) {

	query:= `SELECT DISTINCT course_name FROM public.courses;`

	// make query in courses table
	rows, err := conn.Query(context.Background(), query)
	if err != nil {
		return nil, fmt.Errorf("Failed to query course names: %w", err)
	}
	defer rows.Close()

	var courseNames []string
	var name string

	// iterate rows and add names 
	for rows.Next() {
		if err = rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("Failed to scan course name: %w", err)
		}
		courseNames = append(courseNames, name)
	}

	if rows.Err() != nil {
		return nil, fmt.Errorf("Row iteration error: %w", rows.Err())
	}

	return courseNames, nil
}
