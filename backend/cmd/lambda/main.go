package main

import (
	"context"
	"flag"
	"log"
	"os"
	"strconv"
	"sync"
	"enroll-alert/enrollalert"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	initFlag      = flag.Bool("init", false, "")
	countFlag     = flag.Int("count", 5666, "")
	termFlag      = flag.Int("term", 1262, "")
	batchSizeFlag = flag.Int("batchsize", 100, "")
	parseOnce     sync.Once
)

type Config struct {
	init      bool
	count     int
	term      int
	batchSize int
	pgURL     string
}

func envBool(k string, d bool) bool {
	if v, ok := os.LookupEnv(k); ok {
		b, _ := strconv.ParseBool(v)
		return b
	}
	return d
}

func envInt(k string, d int) int {
	if v, ok := os.LookupEnv(k); ok {
		i, _ := strconv.Atoi(v)
		return i
	}
	return d
}

func load() Config {
	parseOnce.Do(flag.Parse)
	return Config{
		init:      envBool("INIT", *initFlag),
		count:     envInt("COUNT", *countFlag),
		term:      envInt("TERM", *termFlag),
		batchSize: envInt("BATCHSIZE", *batchSizeFlag),
		pgURL:     os.Getenv("POSTGRES_URL"),
	}
}

func run(ctx context.Context, c Config) error {
	enrollalert.TermNum = c.term
	enrollalert.Term = strconv.Itoa(c.term)

	if c.init {
		return enrollalert.InitialDriver(c.count)
	}

	pool, err := pgxpool.New(ctx, c.pgURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	ids, err := enrollalert.GetAllCourseIDs(pool)
	if err != nil {
		return err
	}
	if err := enrollalert.CourseInfoUpdateDriver(pool, ids, c.batchSize); err != nil {
		return err
	}

	mail, err := enrollalert.NewEmailClient(ctx, os.Getenv("EMAIL_FROM"))
	if err != nil {
		return err
	}
	return enrollalert.NotifyMatchingAlerts(ctx, pool, mail, enrollalert.TermNum)
}

func handler(ctx context.Context) error {
	return run(ctx, load())
}

func main() {
	if os.Getenv("AWS_LAMBDA_FUNCTION_NAME") != "" {
		lambda.Start(handler)
		return
	}
	if err := run(context.Background(), load()); err != nil {
		log.Fatal(err)
	}
}

