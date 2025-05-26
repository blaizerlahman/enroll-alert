package enrollalert

import (
	"fmt"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
)

// GetAllCourseNames Queries courses table for all unique course names that have sections.
// Returns list of course names or error if failure
func GetAllCourseIDs(pool *pgxpool.Pool) ([]string, error) {

	// make query in courses table for courses that have had sections listed
	// in the last 24 hours
	rows, err := pool.Query(context.Background(), `
		SELECT DISTINCT course.course_id
		FROM public.courses course
		LEFT JOIN course_section_cache cache
			ON course.course_id = cache.course_id AND cache.term = $1
		WHERE cache.has_section IS DISTINCT FROM false
			OR cache.last_seen IS NULL
			OR cache.last_seen < CURRENT_TIMESTAMP - INTERVAL '24 hours';
	`, TermNum)

	if err != nil {
		return nil, fmt.Errorf("Failed to query course IDs: %w", err)
	}

	defer rows.Close()

	var courseIDs []string
	var name string

	// iterate rows and add names 
	for rows.Next() {
		if err = rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("Failed to scan course name: %w", err)
		}
		courseIDs = append(courseIDs, name)
	}

	if rows.Err() != nil {
		return nil, fmt.Errorf("Row iteration error: %w", rows.Err())
	}

	return courseIDs, nil
}
