package portal

import (
	"encoding/json"
	"net/http"
	"strings"

	"app-protocol/examples/go/cases/tasks/task_create"
	"app-protocol/examples/go/cases/tasks/task_move"
	"app-protocol/examples/go/core/shared"
)

func (a *App) HandleRequest(res http.ResponseWriter, req *http.Request) {
	switch {
	case req.Method == http.MethodGet && req.URL.Path == "/":
		a.renderPage(res, nil)
		return
	case req.Method == http.MethodPost && req.URL.Path == "/actions/tasks/create":
		a.handleCreateAction(res, req)
		return
	case req.Method == http.MethodPost && strings.HasPrefix(req.URL.Path, "/actions/tasks/") && strings.HasSuffix(req.URL.Path, "/status"):
		a.handleMoveAction(res, req)
		return
	case req.Method == http.MethodGet && req.URL.Path == "/health":
		a.writeJSON(res, http.StatusOK, map[string]any{
			"ok":     true,
			"app":    "go-example-portal",
			"status": "ready",
		})
		return
	case req.Method == http.MethodGet && req.URL.Path == "/manifest":
		a.writeJSON(res, http.StatusOK, map[string]any{
			"app":               "go-example-portal",
			"port":              a.registry._providers["port"],
			"registeredDomains": []string{"tasks"},
			"packages":          []string{"designSystem"},
		})
		return
	default:
		http.NotFound(res, req)
		return
	}
}

func (a *App) handleCreateAction(res http.ResponseWriter, req *http.Request) {
	if err := req.ParseForm(); err != nil {
		a.renderPage(res, &Flash{Kind: "error", Message: err.Error()})
		return
	}

	ctx := a.CreateUIContext(shared.Dict{
		"actionPath": "/actions/tasks/create",
	})
	ui := task_create.NewUI(ctx)
	_, err := ui.Service(task_create.TaskCreateInput{
		Title:       req.FormValue("title"),
		Description: req.FormValue("description"),
	})
	if err != nil {
		a.renderPage(res, &Flash{Kind: "error", Message: err.Error()})
		return
	}

	http.Redirect(res, req, "/", http.StatusSeeOther)
}

func (a *App) handleMoveAction(res http.ResponseWriter, req *http.Request) {
	if err := req.ParseForm(); err != nil {
		a.renderPage(res, &Flash{Kind: "error", Message: err.Error()})
		return
	}

	taskID := strings.TrimPrefix(req.URL.Path, "/actions/tasks/")
	taskID = strings.TrimSuffix(taskID, "/status")

	ctx := a.CreateUIContext(shared.Dict{})
	ui := task_move.NewUI(ctx)
	_, err := ui.Service(task_move.TaskMoveInput{
		TaskID:       taskID,
		TargetStatus: task_move.TaskStatus(req.FormValue("targetStatus")),
	})
	if err != nil {
		a.renderPage(res, &Flash{Kind: "error", Message: err.Error()})
		return
	}

	http.Redirect(res, req, "/", http.StatusSeeOther)
}

func (a *App) renderPage(res http.ResponseWriter, flash *Flash) {
	page, err := a.RenderRoot(flash)
	if err != nil {
		http.Error(res, err.Error(), http.StatusInternalServerError)
		return
	}

	a.writeHTML(res, http.StatusOK, string(page))
}

func (a *App) writeHTML(res http.ResponseWriter, statusCode int, body string) {
	res.Header().Set("content-type", "text/html; charset=utf-8")
	res.WriteHeader(statusCode)
	_, _ = res.Write([]byte(body))
}

func (a *App) writeJSON(res http.ResponseWriter, statusCode int, body any) {
	res.Header().Set("content-type", "application/json; charset=utf-8")
	res.WriteHeader(statusCode)
	_ = json.NewEncoder(res).Encode(body)
}
