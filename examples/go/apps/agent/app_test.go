package agent

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"app-protocol/examples/go/core/shared"
)

func TestAgentHostMcpLifecycleAndPolicy(t *testing.T) {
	app := Bootstrap(Config{
		DataDirectory: t.TempDir(),
		Port:          0,
	})

	summary, err := app.ValidateAgenticRuntime()
	if err != nil {
		t.Fatal(err)
	}
	if summary["tools"] != 3 {
		t.Fatalf("expected three published tools, got %d", summary["tools"])
	}
	if summary["mcpEnabled"] != 3 {
		t.Fatalf("expected three MCP-enabled tools, got %d", summary["mcpEnabled"])
	}
	if summary["requireConfirmation"] != 1 {
		t.Fatalf("expected one confirmation-gated tool, got %d", summary["requireConfirmation"])
	}

	requestContext := &shared.AppMcpRequestContext{
		Transport: "test",
		ClientInfo: &shared.AppMcpClientInfo{
			Name:    "agent-host-test",
			Version: "1.0.0",
		},
	}

	if _, err := app.InitializeMCP(&shared.AppMcpInitializeParams{ProtocolVersion: "2099-01-01"}, requestContext); err == nil {
		t.Fatalf("unsupported protocol versions must be rejected")
	}

	initialize, err := app.InitializeMCP(&shared.AppMcpInitializeParams{
		ProtocolVersion: MCPLegacyVersion,
		ClientInfo:      requestContext.ClientInfo,
	}, requestContext)
	if err != nil {
		t.Fatal(err)
	}
	if initialize.ProtocolVersion != MCPProtocolVersion {
		t.Fatalf("initialize should negotiate the current protocol version, got %s", initialize.ProtocolVersion)
	}

	tools, err := app.ListMCPTools(requestContext)
	if err != nil {
		t.Fatal(err)
	}
	if len(tools) != 3 {
		t.Fatalf("expected three MCP tools, got %d", len(tools))
	}

	resources, err := app.ListMCPResources(requestContext)
	if err != nil {
		t.Fatal(err)
	}
	if len(resources) != 4 {
		t.Fatalf("expected system prompt plus one semantic resource per tool, got %d", len(resources))
	}

	systemPrompt, err := app.ReadMCPResource(systemPromptResource, requestContext)
	if err != nil {
		t.Fatal(err)
	}
	if len(systemPrompt.Contents) != 1 || !strings.Contains(systemPrompt.Contents[0].Text, "Tool task_create:") {
		t.Fatalf("system prompt resource should expose the assembled host prompt")
	}

	semanticURI := ""
	for _, resource := range resources {
		if resource.URI != systemPromptResource {
			semanticURI = resource.URI
			break
		}
	}
	if semanticURI == "" {
		t.Fatalf("expected at least one tool semantic resource")
	}

	semanticResource, err := app.ReadMCPResource(semanticURI, requestContext)
	if err != nil {
		t.Fatal(err)
	}
	if len(semanticResource.Contents) != 1 || !strings.Contains(semanticResource.Contents[0].Text, "\"publishedName\"") {
		t.Fatalf("tool semantic resources should expose the projected catalog payload")
	}

	createResult, err := app.CallMCPTool("task_create", map[string]any{
		"title": "Agent host test task",
	}, requestContext)
	if err != nil {
		t.Fatal(err)
	}
	if createResult.IsError {
		t.Fatalf("task_create should execute without confirmation")
	}

	created := decodeStructuredContent[struct {
		Task struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		} `json:"task"`
	}](t, createResult.StructuredContent)
	if created.Task.Status != "todo" {
		t.Fatalf("task_create should return a todo task, got %s", created.Task.Status)
	}

	moveDenied, err := app.CallMCPTool("task_move", map[string]any{
		"taskId":       created.Task.ID,
		"targetStatus": "doing",
	}, requestContext)
	if err != nil {
		t.Fatal(err)
	}
	if !moveDenied.IsError {
		t.Fatalf("task_move must be rejected when confirmation is missing")
	}

	denied := decodeStructuredContent[struct {
		Success bool `json:"success"`
		Error   struct {
			Code string `json:"code"`
		} `json:"error"`
	}](t, moveDenied.StructuredContent)
	if denied.Error.Code != "CONFIRMATION_REQUIRED" {
		t.Fatalf("expected CONFIRMATION_REQUIRED, got %s", denied.Error.Code)
	}

	moveAllowed, err := app.CallMCPTool("task_move", map[string]any{
		"input": map[string]any{
			"taskId":       created.Task.ID,
			"targetStatus": "doing",
		},
		"confirmed": true,
	}, requestContext)
	if err != nil {
		t.Fatal(err)
	}
	if moveAllowed.IsError {
		t.Fatalf("task_move should execute after confirmation")
	}

	moved := decodeStructuredContent[struct {
		Task struct {
			Status string `json:"status"`
		} `json:"task"`
	}](t, moveAllowed.StructuredContent)
	if moved.Task.Status != "doing" {
		t.Fatalf("confirmed task_move should update the task status, got %s", moved.Task.Status)
	}
}

func TestAgentExecuteRoutePublishesMeta(t *testing.T) {
	app := Bootstrap(Config{
		DataDirectory: t.TempDir(),
		Port:          0,
	})

	body, err := json.Marshal(map[string]any{
		"title": "Route metadata task",
	})
	if err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodPost, "/tools/task_create/execute", bytes.NewReader(body))
	request.Header.Set("content-type", "application/json")
	recorder := httptest.NewRecorder()

	app.HandleRequest(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("execute route should return 200, got %d", recorder.Code)
	}

	var envelope struct {
		Success bool `json:"success"`
		Meta    struct {
			ToolName             string `json:"toolName"`
			RequiresConfirmation bool   `json:"requiresConfirmation"`
			ExecutionMode        string `json:"executionMode"`
		} `json:"meta"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}

	if !envelope.Success {
		t.Fatalf("execute route should return success")
	}
	if envelope.Meta.ToolName != "task_create" {
		t.Fatalf("expected toolName task_create, got %s", envelope.Meta.ToolName)
	}
	if envelope.Meta.RequiresConfirmation {
		t.Fatalf("task_create should not require confirmation")
	}
	if envelope.Meta.ExecutionMode != "direct-execution" {
		t.Fatalf("expected direct-execution metadata, got %s", envelope.Meta.ExecutionMode)
	}
}

func decodeStructuredContent[T any](t *testing.T, value any) T {
	t.Helper()

	var decoded T
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatal(err)
	}
	return decoded
}
