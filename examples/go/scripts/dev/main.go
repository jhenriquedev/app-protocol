package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"app-protocol/examples/go/apps/agent"
	"app-protocol/examples/go/apps/backend"
	"app-protocol/examples/go/apps/portal"
)

func main() {
	backendApp := backend.Bootstrap(backend.Config{
		Port:          3000,
		DataDirectory: "packages/data",
	})
	portalApp := portal.Bootstrap(portal.Config{
		APIBaseURL: "http://127.0.0.1:3000",
		Port:       5173,
	})
	agentApp := agent.Bootstrap(agent.Config{
		Port:          3001,
		DataDirectory: "packages/data",
	})

	backendServer, _, err := backendApp.StartBackend()
	if err != nil {
		log.Fatal(err)
	}
	portalServer, _, err := portalApp.StartPortal()
	if err != nil {
		log.Fatal(err)
	}
	agentServer, _, err := agentApp.StartAgent()
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("backend: http://127.0.0.1:3000")
	fmt.Println("portal: http://127.0.0.1:5173")
	fmt.Println("agent: http://127.0.0.1:3001")
	fmt.Println("agent catalog: http://127.0.0.1:3001/catalog")
	fmt.Println("agent remote MCP: http://127.0.0.1:3001/mcp")
	fmt.Println("run MCP stdio separately with: go run ./scripts/agent_mcp_stdio")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	_ = backendServer.Shutdown(context.Background())
	_ = portalServer.Shutdown(context.Background())
	_ = agentServer.Shutdown(context.Background())
}
