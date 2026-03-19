package portal

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"app-protocol/examples/go/apps/backend"
)

func TestPortalHostRendersAndExecutesActions(t *testing.T) {
	backendApp := backend.Bootstrap(backend.Config{
		DataDirectory: t.TempDir(),
		Port:          0,
	})
	backendServer, backendListener, err := backendApp.StartBackend()
	if err != nil {
		t.Fatal(err)
	}
	defer backendServer.Shutdown(context.Background())

	app := Bootstrap(Config{
		APIBaseURL: "http://" + backendListener.Addr().String(),
		Port:       0,
	})

	healthRecorder := httptest.NewRecorder()
	app.HandleRequest(healthRecorder, httptest.NewRequest(http.MethodGet, "/health", nil))
	if healthRecorder.Code != http.StatusOK {
		t.Fatalf("health should return 200, got %d", healthRecorder.Code)
	}
	if contentType := healthRecorder.Header().Get("content-type"); !strings.Contains(contentType, "application/json") {
		t.Fatalf("health should return JSON, got %s", contentType)
	}

	var health map[string]any
	if err := json.Unmarshal(healthRecorder.Body.Bytes(), &health); err != nil {
		t.Fatal(err)
	}
	if health["ok"] != true {
		t.Fatalf("portal health should be ready")
	}

	rootRecorder := httptest.NewRecorder()
	app.HandleRequest(rootRecorder, httptest.NewRequest(http.MethodGet, "/", nil))
	if rootRecorder.Code != http.StatusOK {
		t.Fatalf("root should render successfully, got %d", rootRecorder.Code)
	}
	if !strings.Contains(rootRecorder.Body.String(), "Task Board") {
		t.Fatalf("root should render the task board shell")
	}

	createForm := url.Values{
		"title":       {"Portal host task"},
		"description": {"Created through portal action"},
	}
	createRequest := httptest.NewRequest(http.MethodPost, "/actions/tasks/create", bytes.NewBufferString(createForm.Encode()))
	createRequest.Header.Set("content-type", "application/x-www-form-urlencoded")
	createRecorder := httptest.NewRecorder()
	app.HandleRequest(createRecorder, createRequest)
	if createRecorder.Code != http.StatusSeeOther {
		t.Fatalf("create action should redirect, got %d", createRecorder.Code)
	}

	updatedRoot := httptest.NewRecorder()
	app.HandleRequest(updatedRoot, httptest.NewRequest(http.MethodGet, "/", nil))
	if !strings.Contains(updatedRoot.Body.String(), "Portal host task") {
		t.Fatalf("created task should appear on the rendered board")
	}
}
