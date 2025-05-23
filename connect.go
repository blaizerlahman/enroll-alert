package main

import (
	"os"
	"context"
	"fmt"
	"log"
	"github.com/jackc/pgx/v5"
)

func connect() {

	// opening connection
	connStr := os.Getenv("POSTGRES_URL")
	conn, err := pgx.Connect(context.Background(), connStr);

	if err != nil {
		log.Fatal("Unable to connect: %v", err)
	}

	defer conn.Close(context.Background())

	fmt.Println("Connected with pgx!")
	
	// creating CS400 class
	// _, err = conn.Exec(context.Background(), `
	//   INSERT INTO courses (total_seats, open_seats, waitlist_count, last_update, code, section)
	// 	VALUES ($1, $2, $3, NOW(), $4, $5)
	// `, 100, 95, 2, "CS400", "001")

	// if err != nil {
	// 	log.Fatalf("Update failed: ", err)
	// }

	// creating test user
	// _, err = conn.Exec(context.Background(), `
	// 	INSERT INTO public.users (email, phone_number, joined_at)
	// 	VALUES ($1, $2, NOW())
	// `, "exampleuser@email.com", nil)

	// if err != nil {
	// 	log.Fatalf("Update failed: ", err)
	// }

	// creating test user courses
	// _, err = conn.Exec(context.Background(), `
	// 	INSERT INTO user_courses (user_id, course_id)
	// 	VALUES ($1, $2)
	// `, 1, 1)
	//
	// if err != nil {
	// 	log.Fatalf("Update failed: ", err)
  // 	}
}


