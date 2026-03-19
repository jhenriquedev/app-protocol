package task_create

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"app-protocol/examples/go/core"
	"app-protocol/examples/go/core/shared"
)

type TaskStore interface {
	Read() ([]map[string]any, error)
	Write(value []map[string]any) error
	Reset() error
	Update(updater func(current []map[string]any) ([]map[string]any, error)) ([]map[string]any, error)
}

type API struct {
	Ctx        *core.ApiContext
	domainCase *Domain
}

func NewAPI(ctx *core.ApiContext) *API {
	return &API{
		Ctx:        ctx,
		domainCase: NewDomain(),
	}
}

func (c *API) Handler(input TaskCreateInput) core.ApiResponse[TaskCreateOutput] {
	result := core.ExecuteAPI(
		input,
		c.validate,
		nil,
		nil,
		c.service,
	)

	if result.Success {
		result.StatusCode = 201
		return result
	}

	result.StatusCode = mapErrorCodeToStatus(result.Error)
	return result
}

func (c *API) HandleAny(input any) (any, error) {
	parsed, err := c.parseInput(input)
	if err != nil {
		return c.failure("VALIDATION_FAILED", err, mapErrorCodeToStatus(&shared.AppError{Code: "VALIDATION_FAILED"})), nil
	}

	response := c.Handler(parsed)
	return response, nil
}

func (c *API) Router() core.RouteBinding {
	return core.RouteBinding{
		Method: "POST",
		Path:   "/tasks",
		Handler: func(request core.RouteRequest) (any, error) {
			parsed, err := c.parseInput(request.Body)
			if err != nil {
				return c.failure("VALIDATION_FAILED", err, 400), nil
			}

			return c.Handler(parsed), nil
		},
	}
}

func (c *API) Test() error {
	store, err := c.resolveTaskStore()
	if err != nil {
		return err
	}

	if err := store.Reset(); err != nil {
		return err
	}

	result := c.Handler(TaskCreateInput{
		Title:       "Test task",
		Description: "Created by task_create.api test",
	})

	if !result.Success || result.Data == nil {
		return fmt.Errorf("test: handler should return success")
	}

	if result.StatusCode != 201 {
		return fmt.Errorf("test: successful create must return statusCode 201")
	}

	if result.Data.Task.Status != TaskStatusTodo {
		return fmt.Errorf("test: created task must start in todo")
	}

	persisted, err := store.Read()
	if err != nil {
		return err
	}

	if len(persisted) != 1 {
		return fmt.Errorf("test: created task must be persisted")
	}

	if err := store.Reset(); err != nil {
		return err
	}

	for index := 0; index < 4; index++ {
		response := c.Handler(TaskCreateInput{
			Title: fmt.Sprintf("Concurrent task %d", index+1),
		})
		if !response.Success {
			return fmt.Errorf("test: concurrent creates must all succeed")
		}
	}

	concurrentPersisted, err := store.Read()
	if err != nil {
		return err
	}

	if len(concurrentPersisted) != 4 {
		return fmt.Errorf("test: concurrent creates must persist every task")
	}

	if _, err := c.parseInput(map[string]any{"title": "   "}); err == nil {
		return fmt.Errorf("test: parseInput must reject blank title")
	}

	return nil
}

func (c *API) parseInput(value any) (TaskCreateInput, error) {
	return c.domainCase.ParseInput(value)
}

func (c *API) validate(input TaskCreateInput) error {
	if err := c.domainCase.Validate(input); err != nil {
		return &shared.AppCaseError{
			Code:    "VALIDATION_FAILED",
			Message: err.Error(),
		}
	}

	return nil
}

func (c *API) service(input TaskCreateInput) (TaskCreateOutput, error) {
	taskStore, err := c.resolveTaskStore()
	if err != nil {
		return TaskCreateOutput{}, err
	}

	timestamp := time.Now().UTC().Format(time.RFC3339Nano)
	task := Task{
		ID:          newID(),
		Title:       strings.TrimSpace(input.Title),
		Description: strings.TrimSpace(input.Description),
		Status:      TaskStatusTodo,
		CreatedAt:   timestamp,
		UpdatedAt:   timestamp,
	}

	if _, err := taskStore.Update(func(current []map[string]any) ([]map[string]any, error) {
		record, err := taskToRecord(task)
		if err != nil {
			return nil, err
		}

		return append([]map[string]any{record}, current...), nil
	}); err != nil {
		return TaskCreateOutput{}, err
	}

	if c.Ctx.Logger != nil {
		c.Ctx.Logger.Info("task_create: task persisted", map[string]any{
			"taskId": task.ID,
			"title":  task.Title,
		})
	}

	output := TaskCreateOutput{Task: task}
	if err := c.domainCase.ValidateOutput(output); err != nil {
		return TaskCreateOutput{}, err
	}

	return output, nil
}

func (c *API) resolveTaskStore() (TaskStore, error) {
	if c.Ctx == nil || c.Ctx.Extra == nil {
		return nil, &shared.AppCaseError{
			Code:    "INTERNAL",
			Message: "task_create requires a configured taskStore provider",
		}
	}

	providers, ok := c.Ctx.Extra["providers"].(shared.Dict)
	if !ok {
		return nil, &shared.AppCaseError{
			Code:    "INTERNAL",
			Message: "task_create requires a configured taskStore provider",
		}
	}

	taskStore, ok := providers["taskStore"].(TaskStore)
	if !ok || taskStore == nil {
		return nil, &shared.AppCaseError{
			Code:    "INTERNAL",
			Message: "task_create requires a configured taskStore provider",
		}
	}

	return taskStore, nil
}

func (c *API) failure(code string, err error, statusCode int) core.ApiResponse[TaskCreateOutput] {
	appErr := shared.ToAppError(&shared.AppCaseError{
		Code:    code,
		Message: err.Error(),
	}, code)

	return core.ApiResponse[TaskCreateOutput]{
		AppResult: shared.AppResult[TaskCreateOutput]{
			Success: false,
			Error:   &appErr,
		},
		StatusCode: statusCode,
	}
}

func mapErrorCodeToStatus(err *shared.AppError) int {
	if err == nil {
		return 500
	}

	switch err.Code {
	case "VALIDATION_FAILED":
		return 400
	case "NOT_FOUND":
		return 404
	default:
		return 500
	}
}

func taskToRecord(task Task) (map[string]any, error) {
	encoded, err := json.Marshal(task)
	if err != nil {
		return nil, err
	}

	var record map[string]any
	if err := json.Unmarshal(encoded, &record); err != nil {
		return nil, err
	}

	return record, nil
}

func newID() string {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}

	return hex.EncodeToString(buffer)
}
