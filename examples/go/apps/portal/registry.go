package portal

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"time"

	"app-protocol/examples/go/cases/tasks/task_create"
	"app-protocol/examples/go/cases/tasks/task_list"
	"app-protocol/examples/go/cases/tasks/task_move"
	"app-protocol/examples/go/core"
	"app-protocol/examples/go/core/shared"
	designsystem "app-protocol/examples/go/packages/design_system"
)

type Config struct {
	APIBaseURL string
	Port       int
}

type Registry struct {
	_cases     map[string]map[string]shared.AppCaseSurfaces
	_providers shared.Dict
	_packages  shared.Dict
}

type DesignSystemPackage struct{}

func NewDesignSystemPackage() *DesignSystemPackage {
	return &DesignSystemPackage{}
}

func (DesignSystemPackage) AppShell(title string, subtitle string, actions template.HTML, content template.HTML) template.HTML {
	return designsystem.AppShell(title, subtitle, actions, content)
}

func (DesignSystemPackage) BoardHeader(title string, subtitle string) template.HTML {
	return designsystem.BoardHeader(title, subtitle)
}

func (DesignSystemPackage) CreateTaskForm(action string, titleValue string, descriptionValue string, errorMessage string) template.HTML {
	return designsystem.CreateTaskForm(action, titleValue, descriptionValue, errorMessage)
}

func (DesignSystemPackage) TaskBoard(columns []template.HTML) template.HTML {
	return designsystem.TaskBoard(columns)
}

func (DesignSystemPackage) TaskColumn(title string, count int, children []template.HTML) template.HTML {
	return designsystem.TaskColumn(title, count, children)
}

func (DesignSystemPackage) TaskCard(title string, description string, status string, actions template.HTML) template.HTML {
	return designsystem.TaskCard(title, description, designsystem.TaskStatus(status), actions)
}

func (DesignSystemPackage) EmptyColumnState(message string) template.HTML {
	return designsystem.EmptyColumnState(message)
}

func (DesignSystemPackage) Feedback(kind string, message string) template.HTML {
	return designsystem.Feedback(kind, message)
}

func (DesignSystemPackage) MoveTaskAction(action string, currentStatus string) template.HTML {
	return designsystem.MoveTaskAction(action, designsystem.TaskStatus(currentStatus))
}

type HTTPAdapter struct {
	baseURL string
	client  *http.Client
}

func NewHTTPAdapter(baseURL string) *HTTPAdapter {
	return &HTTPAdapter{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (a *HTTPAdapter) Request(config any) (any, error) {
	record, ok := config.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("portal http adapter expects a map config")
	}

	method, _ := record["method"].(string)
	urlPath, _ := record["url"].(string)

	var body io.Reader
	if requestBody, hasBody := record["body"]; hasBody && requestBody != nil {
		encoded, err := json.Marshal(requestBody)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(encoded)
	}

	req, err := http.NewRequest(method, a.baseURL+urlPath, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("content-type", "application/json")

	response, err := a.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusNoContent {
		return nil, nil
	}

	content, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	var payload struct {
		Success bool             `json:"success"`
		Data    json.RawMessage  `json:"data"`
		Error   *shared.AppError `json:"error,omitempty"`
	}
	if err := json.Unmarshal(content, &payload); err == nil && (payload.Success || payload.Error != nil) {
		if !payload.Success {
			if payload.Error != nil {
				return nil, &shared.AppCaseError{
					Code:    payload.Error.Code,
					Message: payload.Error.Message,
					Details: payload.Error.Details,
				}
			}
			return nil, fmt.Errorf("request failed")
		}

		if len(payload.Data) == 0 {
			return nil, nil
		}

		var decoded any
		if err := json.Unmarshal(payload.Data, &decoded); err != nil {
			return nil, err
		}
		return decoded, nil
	}

	var decoded any
	if err := json.Unmarshal(content, &decoded); err != nil {
		return nil, fmt.Errorf("HTTP %d while requesting %s", response.StatusCode, urlPath)
	}

	if response.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d while requesting %s", response.StatusCode, urlPath)
	}

	return decoded, nil
}

func CreateRegistry(config Config) *Registry {
	if config.APIBaseURL == "" {
		config.APIBaseURL = "http://127.0.0.1:3000"
	}

	return &Registry{
		_cases: map[string]map[string]shared.AppCaseSurfaces{
			"tasks": {
				"task_create": {
					UI: func(ctx any) any {
						return task_create.NewUI(ctx.(*core.UiContext))
					},
				},
				"task_list": {
					UI: func(ctx any) any {
						return task_list.NewUI(ctx.(*core.UiContext))
					},
				},
				"task_move": {
					UI: func(ctx any) any {
						return task_move.NewUI(ctx.(*core.UiContext))
					},
				},
			},
		},
		_providers: shared.Dict{
			"httpClient": NewHTTPAdapter(config.APIBaseURL),
			"port":       config.Port,
		},
		_packages: shared.Dict{
			"designSystem": NewDesignSystemPackage(),
		},
	}
}

func (r *Registry) Cases() map[string]map[string]shared.AppCaseSurfaces {
	return r._cases
}

func (r *Registry) Providers() shared.Dict {
	return r._providers
}

func (r *Registry) Packages() shared.Dict {
	return r._packages
}
