package backend

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

type hostEnvelope[T any] struct {
	Success bool `json:"success"`
	Data    *T   `json:"data,omitempty"`
	Error   *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type hostTask struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Status string `json:"status"`
}

func TestBackendHostRoutes(t *testing.T) {
	app := Bootstrap(Config{
		DataDirectory: t.TempDir(),
		Port:          0,
	})

	manifestRecorder := performJSONRequest(t, app, http.MethodGet, "/manifest", nil)
	if manifestRecorder.Code != http.StatusOK {
		t.Fatalf("manifest should return 200, got %d", manifestRecorder.Code)
	}

	var manifest struct {
		App    string   `json:"app"`
		Routes []string `json:"routes"`
	}
	if err := json.Unmarshal(manifestRecorder.Body.Bytes(), &manifest); err != nil {
		t.Fatal(err)
	}
	if manifest.App != "go-example-backend" {
		t.Fatalf("unexpected manifest app: %s", manifest.App)
	}
	if len(manifest.Routes) != 3 {
		t.Fatalf("manifest should publish three declarative routes, got %d", len(manifest.Routes))
	}

	created := decodeHostSuccess[struct {
		Task hostTask `json:"task"`
	}](t, performJSONRequest(t, app, http.MethodPost, "/tasks", map[string]any{
		"title": "Backend host test task",
	}), http.StatusCreated)
	if created.Task.Status != "todo" {
		t.Fatalf("created task should start in todo, got %s", created.Task.Status)
	}

	moved := decodeHostSuccess[struct {
		Task hostTask `json:"task"`
	}](t, performJSONRequest(t, app, http.MethodPatch, "/tasks/"+created.Task.ID+"/status", map[string]any{
		"targetStatus": "doing",
	}), http.StatusOK)
	if moved.Task.Status != "doing" {
		t.Fatalf("moved task should reach doing, got %s", moved.Task.Status)
	}

	listed := decodeHostSuccess[struct {
		Tasks []hostTask `json:"tasks"`
	}](t, performJSONRequest(t, app, http.MethodGet, "/tasks", nil), http.StatusOK)
	if len(listed.Tasks) != 1 {
		t.Fatalf("expected one persisted task, got %d", len(listed.Tasks))
	}
	if listed.Tasks[0].ID != created.Task.ID {
		t.Fatalf("expected listed task %s, got %s", created.Task.ID, listed.Tasks[0].ID)
	}
	if listed.Tasks[0].Status != "doing" {
		t.Fatalf("expected moved status to persist, got %s", listed.Tasks[0].Status)
	}
}

func performJSONRequest(t *testing.T, app *App, method string, path string, body any) *httptest.ResponseRecorder {
	t.Helper()

	var payload []byte
	if body != nil {
		var err error
		payload, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}

	request := httptest.NewRequest(method, path, bytes.NewReader(payload))
	if body != nil {
		request.Header.Set("content-type", "application/json")
	}

	recorder := httptest.NewRecorder()
	app.HandleRequest(recorder, request)
	return recorder
}

func decodeHostSuccess[T any](t *testing.T, recorder *httptest.ResponseRecorder, expectedStatus int) T {
	t.Helper()

	if recorder.Code != expectedStatus {
		t.Fatalf("expected HTTP %d, got %d", expectedStatus, recorder.Code)
	}

	var envelope hostEnvelope[T]
	if err := json.Unmarshal(recorder.Body.Bytes(), &envelope); err != nil {
		t.Fatal(err)
	}
	if !envelope.Success || envelope.Data == nil {
		t.Fatalf("expected successful host envelope, got %s", recorder.Body.String())
	}
	return *envelope.Data
}
