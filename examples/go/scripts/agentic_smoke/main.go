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

type envelope[T any] struct {
	Success bool `json:"success"`
	Data    *T   `json:"data,omitempty"`
	Error   *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type boardTask struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Status      string `json:"status"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
	fmt.Println("agentic_smoke: ok")
}

func run() error {
	tempDirectory, err := os.MkdirTemp("", "app-go-agentic-smoke-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tempDirectory)

	backendApp := backend.Bootstrap(backend.Config{DataDirectory: tempDirectory, Port: 0})
	backendServer, backendListener, err := backendApp.StartBackend()
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

	_ = backendListener
	baseURL := "http://" + agentListener.Addr().String()

	catalog, err := getSuccess[struct {
		SystemPrompt string `json:"systemPrompt"`
		Resources    []struct {
			URI string `json:"uri"`
		} `json:"resources"`
		Tools []struct {
			PublishedName        string `json:"publishedName"`
			RequiresConfirmation bool   `json:"requiresConfirmation"`
		} `json:"tools"`
	}](baseURL + "/catalog")
	if err != nil {
		return err
	}

	if len(catalog.Tools) != 3 {
		return fmt.Errorf("agentic_smoke: agent catalog must expose the three task tools")
	}

	created, err := postSuccess[struct {
		Task boardTask `json:"task"`
	}](baseURL+"/tools/task_create/execute", map[string]any{
		"title":       "Agent-created task",
		"description": "Created through apps/agent",
	})
	if err != nil {
		return err
	}

	if created.Task.Status != "todo" {
		return fmt.Errorf("agentic_smoke: task_create must create a todo task")
	}

	listed, err := postSuccess[struct {
		Tasks []boardTask `json:"tasks"`
	}](baseURL+"/tools/task_list/execute", map[string]any{})
	if err != nil {
		return err
	}
	if len(listed.Tasks) == 0 {
		return fmt.Errorf("agentic_smoke: task_list must return persisted tasks")
	}

	moveWithoutConfirmation, err := doRawJSON(http.MethodPost, baseURL+"/tools/task_move/execute", map[string]any{
		"taskId":       created.Task.ID,
		"targetStatus": "doing",
	})
	if err != nil {
		return err
	}
	defer moveWithoutConfirmation.Body.Close()

	moveFailure := envelope[map[string]any]{}
	if err := json.NewDecoder(moveWithoutConfirmation.Body).Decode(&moveFailure); err != nil {
		return err
	}
	if moveWithoutConfirmation.StatusCode != 409 || moveFailure.Error == nil || moveFailure.Error.Code != "CONFIRMATION_REQUIRED" {
		return fmt.Errorf("agentic_smoke: task_move must require confirmation")
	}

	moved, err := postSuccess[struct {
		Task boardTask `json:"task"`
	}](baseURL+"/tools/task_move/execute", map[string]any{
		"input": map[string]any{
			"taskId":       created.Task.ID,
			"targetStatus": "doing",
		},
		"confirmed": true,
	})
	if err != nil {
		return err
	}
	if moved.Task.Status != "doing" {
		return fmt.Errorf("agentic_smoke: confirmed task_move must succeed")
	}

	return nil
}

func getSuccess[T any](url string) (T, error) {
	response, err := http.Get(url)
	if err != nil {
		var zero T
		return zero, err
	}
	defer response.Body.Close()
	return decodeSuccess[T](response)
}

func postSuccess[T any](url string, body any) (T, error) {
	response, err := doRawJSON(http.MethodPost, url, body)
	if err != nil {
		var zero T
		return zero, err
	}
	defer response.Body.Close()
	return decodeSuccess[T](response)
}

func doRawJSON(method string, url string, body any) (*http.Response, error) {
	encoded, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(method, url, bytes.NewReader(encoded))
	if err != nil {
		return nil, err
	}
	req.Header.Set("content-type", "application/json")
	return http.DefaultClient.Do(req)
}

func decodeSuccess[T any](response *http.Response) (T, error) {
	var zero T
	payload := envelope[T]{}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return zero, err
	}
	if response.StatusCode >= 400 || !payload.Success || payload.Data == nil {
		if payload.Error != nil {
			return zero, fmt.Errorf("%s", payload.Error.Message)
		}
		return zero, fmt.Errorf("request failed with HTTP %d", response.StatusCode)
	}
	return *payload.Data, nil
}
