package main

import (
	"log"
	"os"

	"app-protocol/examples/go/apps/agent"
)

func main() {
	dataDirectory := os.Getenv("APP_GO_DATA_DIR")
	if dataDirectory == "" {
		dataDirectory = "packages/data"
	}

	app := agent.Bootstrap(agent.Config{
		DataDirectory: dataDirectory,
	})

	if err := app.PublishMCP(); err != nil {
		log.Fatal(err)
	}
}
