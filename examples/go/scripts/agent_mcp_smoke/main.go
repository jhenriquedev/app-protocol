package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"

	"app-protocol/examples/go/apps/backend"
)

type jsonRPCResponse struct {
	JSONRPC string `json:"jsonrpc"`
	ID      any    `json:"id"`
	Result  any    `json:"result,omitempty"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    any    `json:"data,omitempty"`
	} `json:"error,omitempty"`
}

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("agent_mcp_smoke: ok")
}

func run() error {
	tempDirectory, err := os.MkdirTemp("", "app-go-agent-mcp-smoke-")
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

	cmd := exec.Command("go", "run", "./scripts/agent_mcp_stdio")
	cmd.Dir = "."
	cmd.Env = append(os.Environ(), "APP_GO_DATA_DIR="+tempDirectory)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return err
	}
	defer cmd.Process.Kill()

	_ = stderr
	reader := bufio.NewReader(stdout)

	send := func(payload any) (jsonRPCResponse, error) {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return jsonRPCResponse{}, err
		}
		if _, err := stdin.Write(append(encoded, '\n')); err != nil {
			return jsonRPCResponse{}, err
		}
		line, err := reader.ReadBytes('\n')
		if err != nil {
			return jsonRPCResponse{}, err
		}
		response := jsonRPCResponse{}
		if err := json.Unmarshal(line, &response); err != nil {
			return jsonRPCResponse{}, err
		}
		return response, nil
	}

	initialize, err := send(map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": "2025-06-18",
			"capabilities": map[string]any{
				"tools": map[string]any{},
			},
			"clientInfo": map[string]any{
				"name":    "agent-mcp-smoke",
				"version": "1.0.0",
			},
		},
	})
	if err != nil {
		return err
	}
	if initialize.Error != nil {
		return fmt.Errorf("agent_mcp_smoke: initialize failed: %s", initialize.Error.Message)
	}

	notification, err := json.Marshal(map[string]any{
		"jsonrpc": "2.0",
		"method":  "notifications/initialized",
		"params":  map[string]any{},
	})
	if err != nil {
		return err
	}
	if _, err := stdin.Write(append(notification, '\n')); err != nil {
		return err
	}

	toolsList, err := send(map[string]any{
		"jsonrpc": "2.0",
		"id":      2,
		"method":  "tools/list",
		"params":  map[string]any{},
	})
	if err != nil {
		return err
	}
	if toolsList.Error != nil {
		return fmt.Errorf("agent_mcp_smoke: tools/list failed: %s", toolsList.Error.Message)
	}

	resourcesList, err := send(map[string]any{
		"jsonrpc": "2.0",
		"id":      3,
		"method":  "resources/list",
		"params":  map[string]any{},
	})
	if err != nil {
		return err
	}
	if resourcesList.Error != nil {
		return fmt.Errorf("agent_mcp_smoke: resources/list failed: %s", resourcesList.Error.Message)
	}

	resourcesPayload, err := encodeDecodeMap(resourcesList.Result)
	if err != nil {
		return err
	}
	resources, _ := resourcesPayload["resources"].([]any)
	if len(resources) != 4 {
		return fmt.Errorf("agent_mcp_smoke: resources/list must expose system prompt plus one semantic resource per tool")
	}

	systemPrompt, err := send(map[string]any{
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
	if systemPrompt.Error != nil {
		return fmt.Errorf("agent_mcp_smoke: resources/read failed: %s", systemPrompt.Error.Message)
	}

	createCall, err := send(map[string]any{
		"jsonrpc": "2.0",
		"id":      5,
		"method":  "tools/call",
		"params": map[string]any{
			"name": "task_create",
			"arguments": map[string]any{
				"title": "Stdio MCP task",
			},
		},
	})
	if err != nil {
		return err
	}
	if createCall.Error != nil {
		return fmt.Errorf("agent_mcp_smoke: tools/call failed: %s", createCall.Error.Message)
	}

	return nil
}

func encodeDecodeMap(value any) (map[string]any, error) {
	encoded, err := json.Marshal(value)
	if err != nil {
		return nil, err
	}
	decoded := map[string]any{}
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		return nil, err
	}
	return decoded, nil
}
