package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"app-protocol/examples/go/apps/agent"
	"app-protocol/examples/go/apps/backend"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("agent_mcp_http_smoke: ok")
}

func run() error {
	tempDirectory, err := os.MkdirTemp("", "app-go-agent-mcp-http-smoke-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tempDirectory)

	backendApp := backend.Bootstrap(backend.Config{DataDirectory: tempDirectory, Port: 0})
	backendServer, _, err := backendApp.StartBackend()
	if err != nil {
		return err
	}
	defer backendServer.Shutdown(context.Background())

	agentApp := agent.Bootstrap(agent.Config{DataDirectory: tempDirectory, Port: 0})
	agentServer, agentListener, err := agentApp.StartAgent()
	if err != nil {
		return err
	}
	defer agentServer.Shutdown(context.Background())

	mcpURL := "http://" + agentListener.Addr().String() + "/mcp"

	getResponse, err := http.Get(mcpURL)
	if err != nil {
		return err
	}
	getResponse.Body.Close()
	if getResponse.StatusCode != 405 {
		return fmt.Errorf("agent_mcp_http_smoke: GET /mcp should explicitly reject SSE when unsupported")
	}

	unsupportedInitialize, err := mcpPost(mcpURL, map[string]any{
		"jsonrpc": "2.0",
		"id":      0,
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": "2099-01-01",
		},
	})
	if err != nil {
		return err
	}
	if unsupportedInitialize["error"] == nil {
		return fmt.Errorf("agent_mcp_http_smoke: unsupported MCP versions must be rejected")
	}

	initialize, err := mcpPost(mcpURL, map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": "2025-06-18",
			"capabilities": map[string]any{
				"tools": map[string]any{},
			},
			"clientInfo": map[string]any{
				"name":    "agent-mcp-http-smoke",
				"version": "1.0.0",
			},
		},
	})
	if err != nil {
		return err
	}
	if initialize["result"] == nil {
		return fmt.Errorf("agent_mcp_http_smoke: initialize must return a result")
	}

	toolsList, err := mcpPost(mcpURL, map[string]any{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  "tools/list",
		"params":  map[string]any{},
	})
	if err != nil {
		return err
	}
	result := toolsList["result"].(map[string]any)
	tools := result["tools"].([]any)
	if len(tools) != 3 {
		return fmt.Errorf("agent_mcp_http_smoke: remote MCP tools/list must expose the three task tools")
	}

	resourcesList, err := mcpPost(mcpURL, map[string]any{
		"jsonrpc": "2.0",
		"id":      3,
		"method":  "resources/list",
		"params":  map[string]any{},
	})
	if err != nil {
		return err
	}
	resourceResult := resourcesList["result"].(map[string]any)
	resources := resourceResult["resources"].([]any)
	if len(resources) != 4 {
		return fmt.Errorf("agent_mcp_http_smoke: resources/list must expose system prompt plus one semantic resource per tool")
	}

	systemPrompt, err := mcpPost(mcpURL, map[string]any{
		"jsonrpc": "2.0",
		"id":      4,
		"method":  "resources/read",
		"params": map[string]any{
			"uri": "app://agent/system/prompt",
		},
	})
	if err != nil {
		return err
	}
	systemPromptResult := systemPrompt["result"].(map[string]any)
	contents := systemPromptResult["contents"].([]any)
	if len(contents) != 1 {
		return fmt.Errorf("agent_mcp_http_smoke: resources/read must return the system prompt content")
	}

	createCall, err := mcpPost(mcpURL, map[string]any{
		"jsonrpc": "2.0",
		"id":      5,
		"method":  "tools/call",
		"params": map[string]any{
			"name": "task_create",
			"arguments": map[string]any{
				"title": "Remote MCP task",
			},
		},
	})
	if err != nil {
		return err
	}
	createResult := createCall["result"].(map[string]any)
	if createResult["isError"] == true {
		return fmt.Errorf("agent_mcp_http_smoke: remote MCP task_create must succeed")
	}

	return nil
}

func mcpPost(endpoint string, payload any) (map[string]any, error) {
	encoded, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	response, err := http.Post(endpoint, "application/json", bytes.NewReader(encoded))
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	decoded := map[string]any{}
	if err := json.NewDecoder(response.Body).Decode(&decoded); err != nil {
		return nil, err
	}
	return decoded, nil
}
