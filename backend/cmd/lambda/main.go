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

type config struct {
	init      bool
	count     int
	term      int
	batchSize int
	pgURL     string
}

func envOrFlagBool(env string, def bool) bool {
	if v, ok := os.LookupEnv(env); ok {
		b, err := strconv.ParseBool(v)
		if err == nil {
			return b
		}
	}
	return def
}

func envOrFlagInt(env string, def int) int {
	if v, ok := os.LookupEnv(env); ok {
		i, err := strconv.Atoi(v)
		if err == nil {
			return i
		}
	}
	return def
}

func loadConfig() config {
	parseOnce.Do(flag.Parse)

	return config{
		init:      envOrFlagBool("INIT", *initFlag),
		count:     envOrFlagInt("COUNT", *countFlag),
		term:      envOrFlagInt("TERM", *termFlag),
		batchSize: envOrFlagInt("BATCHSIZE", *batchSizeFlag),
		pgURL:     os.Getenv("POSTGRES_URL"),
	}
}

func run(ctx context.Context, cfg config) error {
	enrollalert.TermNum = cfg.term
	enrollalert.Term = strconv.Itoa(cfg.term)

	if cfg.init {
		return enrollalert.InitialDriver(cfg.count)
	}

	pool, err := pgxpool.New(ctx, cfg.pgURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	ids, err := enrollalert.GetAllCourseIDs(pool)
	if err != nil {
		return err
	}
	return enrollalert.CourseInfoUpdateDriver(pool, ids, cfg.batchSize)
}

func handler(ctx context.Context) error {
	return run(ctx, loadConfig())
}

func main() {
	if os.Getenv("AWS_LAMBDA_FUNCTION_NAME") != "" {
		lambda.Start(handler)
		return
	}
	if err := run(context.Background(), loadConfig()); err != nil {
		log.Fatal(err)
	}
}

