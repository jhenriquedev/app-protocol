package portal

import (
	"fmt"
	"html/template"
	"net"
	"net/http"

	"app-protocol/examples/go/cases/tasks/task_create"
	"app-protocol/examples/go/cases/tasks/task_list"
	"app-protocol/examples/go/cases/tasks/task_move"
	"app-protocol/examples/go/core"
	"app-protocol/examples/go/core/shared"
)

type App struct {
	registry *Registry
	logger   shared.AppLogger
}

type Flash struct {
	Kind    string
	Message string
}

func Bootstrap(config Config) *App {
	return &App{
		registry: CreateRegistry(config),
		logger:   shared.DefaultLogger{Prefix: "[portal]"},
	}
}

func (a *App) Registry() *Registry {
	return a.registry
}

func (a *App) CreateUIContext(extra shared.Dict) *core.UiContext {
	return &core.UiContext{
		AppBaseContext: shared.AppBaseContext{
			CorrelationID: shared.NewID(),
			ExecutionID:   shared.NewID(),
			Logger:        a.logger,
			Config:        shared.Dict{},
		},
		API:      a.registry._providers["httpClient"].(shared.AppHttpClient),
		Packages: a.registry._packages,
		Extra:    extra,
	}
}

func (a *App) RenderRoot(flash *Flash) (template.HTML, error) {
	designSystem := a.registry._packages["designSystem"].(*DesignSystemPackage)

	createCtx := a.CreateUIContext(shared.Dict{
		"actionPath": "/actions/tasks/create",
	})
	createView, err := task_create.NewUI(createCtx).View()
	if err != nil {
		return "", err
	}

	listCtx := a.CreateUIContext(shared.Dict{
		"renderCardActions": task_list.CardActionRenderer(func(task task_list.Task) (template.HTML, error) {
			moveCtx := a.CreateUIContext(shared.Dict{
				"task": task_move.Task{
					ID:          task.ID,
					Title:       task.Title,
					Description: task.Description,
					Status:      task_move.TaskStatus(task.Status),
					CreatedAt:   task.CreatedAt,
					UpdatedAt:   task.UpdatedAt,
				},
				"actionPath": fmt.Sprintf("/actions/tasks/%s/status", task.ID),
			})

			return task_move.NewUI(moveCtx).View()
		}),
	})
	listView, err := task_list.NewUI(listCtx).View()
	if err != nil {
		return "", err
	}

	feedback := template.HTML("")
	if flash != nil && flash.Message != "" {
		feedback = designSystem.Feedback(flash.Kind, flash.Message)
	}

	content := template.HTML(
		string(feedback) +
			string(designSystem.BoardHeader(
				"Board",
				"Tasks load from the backend and each card can move across columns.",
			)) +
			string(createView) +
			string(listView),
	)

	return designSystem.AppShell(
		"Task Board",
		"Go APP example with create, list, and move wired through Cases.",
		template.HTML(""),
		content,
	), nil
}

func (a *App) StartPortal() (*http.Server, net.Listener, error) {
	port, _ := a.registry._providers["port"].(int)
	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return nil, nil, err
	}

	server := &http.Server{
		Handler: http.HandlerFunc(a.HandleRequest),
	}

	go func() {
		_ = server.Serve(listener)
	}()

	a.logger.Info("Portal scaffold started", map[string]any{
		"port": listener.Addr().(*net.TCPAddr).Port,
	})

	return server, listener, nil
}
