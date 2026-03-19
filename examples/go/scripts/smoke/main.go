package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"app-protocol/examples/go/apps/backend"
)

type apiEnvelope[T any] struct {
	Success bool `json:"success"`
	Data    *T   `json:"data,omitempty"`
	Error   *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type task struct {
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
	fmt.Println("smoke: ok")
}

func run() error {
	tempDirectory, err := os.MkdirTemp("", "app-go-smoke-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tempDirectory)

	app := backend.Bootstrap(backend.Config{
		DataDirectory: tempDirectory,
		Port:          0,
	})
	server, listener, err := app.StartBackend()
	if err != nil {
		return err
	}
	defer server.Shutdown(context.Background())

	baseURL := "http://" + listener.Addr().String()

	initialContext := app.CreateAPIContext(nil)
	if initialContext.Cases == nil || initialContext.Cases["tasks"] == nil {
		return fmt.Errorf("smoke: backend host must materialize ctx.cases")
	}
	if initialContext.Packages == nil || initialContext.Packages["data"] == nil {
		return fmt.Errorf("smoke: backend host must materialize ctx.packages")
	}

	health, err := getJSON[map[string]any](baseURL + "/health")
	if err != nil {
		return err
	}
	if health["ok"] != true {
		return fmt.Errorf("smoke: health endpoint must be healthy")
	}

	notFoundResponse, err := http.Get(baseURL + "/missing-route")
	if err != nil {
		return err
	}
	notFoundPayload := apiEnvelope[map[string]any]{}
	if err := json.NewDecoder(notFoundResponse.Body).Decode(&notFoundPayload); err != nil {
		return err
	}
	notFoundResponse.Body.Close()
	if notFoundResponse.StatusCode != 404 || notFoundPayload.Error == nil || notFoundPayload.Error.Code != "NOT_FOUND" {
		return fmt.Errorf("smoke: unknown route must return structured 404")
	}

	created, err := postSuccess[struct {
		Task task `json:"task"`
	}](baseURL+"/tasks", map[string]any{
		"title":       "Smoke test task",
		"description": "Created by the official smoke test",
	})
	if err != nil {
		return err
	}
	if created.Task.Status != "todo" {
		return fmt.Errorf("smoke: new tasks must start in todo")
	}

	listedBeforeMove, err := getSuccess[struct {
		Tasks []task `json:"tasks"`
	}](baseURL + "/tasks")
	if err != nil {
		return err
	}
	if !containsTask(listedBeforeMove.Tasks, created.Task.ID) {
		return fmt.Errorf("smoke: created task must appear in the list")
	}

	moved, err := patchSuccess[struct {
		Task task `json:"task"`
	}](baseURL+"/tasks/"+created.Task.ID+"/status", map[string]any{
		"targetStatus": "doing",
	})
	if err != nil {
		return err
	}
	if moved.Task.Status != "doing" {
		return fmt.Errorf("smoke: move must update the task status")
	}

	for index := 0; index < 8; index++ {
		if _, err := postSuccess[struct {
			Task task `json:"task"`
		}](baseURL+"/tasks", map[string]any{
			"title": fmt.Sprintf("Concurrent smoke task %d", index+1),
		}); err != nil {
			return err
		}
	}

	if err := server.Shutdown(context.Background()); err != nil {
		return err
	}

	restarted := backend.Bootstrap(backend.Config{
		DataDirectory: tempDirectory,
		Port:          0,
	})
	server, listener, err = restarted.StartBackend()
	if err != nil {
		return err
	}
	defer server.Shutdown(context.Background())

	baseURL = "http://" + listener.Addr().String()
	listedAfterRestart, err := getSuccess[struct {
		Tasks []task `json:"tasks"`
	}](baseURL + "/tasks")
	if err != nil {
		return err
	}
	if !containsTask(listedAfterRestart.Tasks, created.Task.ID) {
		return fmt.Errorf("smoke: persistence must survive restart")
	}

	dataPath := filepath.Join(tempDirectory, "tasks.json")
	if _, err := os.Stat(dataPath); err != nil {
		return fmt.Errorf("smoke: tasks.json must exist after persistence: %w", err)
	}

	return nil
}

func containsTask(tasks []task, taskID string) bool {
	for _, task := range tasks {
		if task.ID == taskID {
			return true
		}
	}
	return false
}

func getJSON[T any](url string) (T, error) {
	response, err := http.Get(url)
	if err != nil {
		var zero T
		return zero, err
	}
	defer response.Body.Close()

	var payload T
	err = json.NewDecoder(response.Body).Decode(&payload)
	return payload, err
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
	return doJSON[T](http.MethodPost, url, body)
}

func patchSuccess[T any](url string, body any) (T, error) {
	return doJSON[T](http.MethodPatch, url, body)
}

func doJSON[T any](method string, url string, body any) (T, error) {
	var zero T
	encoded, err := json.Marshal(body)
	if err != nil {
		return zero, err
	}

	req, err := http.NewRequest(method, url, bytes.NewReader(encoded))
	if err != nil {
		return zero, err
	}
	req.Header.Set("content-type", "application/json")

	response, err := http.DefaultClient.Do(req)
	if err != nil {
		return zero, err
	}
	defer response.Body.Close()
	return decodeSuccess[T](response)
}

func decodeSuccess[T any](response *http.Response) (T, error) {
	var zero T
	payload := apiEnvelope[T]{}
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
