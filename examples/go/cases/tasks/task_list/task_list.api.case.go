package task_list

import (
	"encoding/json"
	"fmt"

	"app-protocol/examples/go/core"
	"app-protocol/examples/go/core/shared"
)

type TaskStore interface {
	Read() ([]map[string]any, error)
	Write(value []map[string]any) error
	Reset() error
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

func (c *API) Handler(input TaskListInput) core.ApiResponse[TaskListOutput] {
	result := core.ExecuteAPI(
		input,
		c.validate,
		nil,
		nil,
		c.service,
	)

	if result.Success {
		result.StatusCode = 200
		return result
	}

	result.StatusCode = mapErrorCodeToStatus(result.Error)
	return result
}

func (c *API) HandleAny(input any) (any, error) {
	parsed, err := c.domainCase.ParseInput(input)
	if err != nil {
		return c.failure("VALIDATION_FAILED", err, 400), nil
	}

	return c.Handler(parsed), nil
}

func (c *API) Router() core.RouteBinding {
	return core.RouteBinding{
		Method: "GET",
		Path:   "/tasks",
		Handler: func(_ core.RouteRequest) (any, error) {
			return c.Handler(TaskListInput{}), nil
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

	if err := store.Write([]map[string]any{
		mustTaskRecord(Task{
			ID:        "task_001",
			Title:     "Older task",
			Status:    TaskStatusTodo,
			CreatedAt: "2026-03-18T12:00:00.000Z",
			UpdatedAt: "2026-03-18T12:00:00.000Z",
		}),
		mustTaskRecord(Task{
			ID:        "task_002",
			Title:     "Newer task",
			Status:    TaskStatusDoing,
			CreatedAt: "2026-03-18T12:30:00.000Z",
			UpdatedAt: "2026-03-18T12:30:00.000Z",
		}),
	}); err != nil {
		return err
	}

	result := c.Handler(TaskListInput{})
	if !result.Success || result.Data == nil {
		return fmt.Errorf("test: handler should return a successful task list")
	}

	if len(result.Data.Tasks) != 2 {
		return fmt.Errorf("test: task list should return all persisted tasks")
	}

	if result.Data.Tasks[0].ID != "task_002" {
		return fmt.Errorf("test: task list should sort by createdAt descending")
	}

	if err := store.Write([]map[string]any{
		{
			"id":        "broken",
			"title":     "Broken task",
			"status":    "broken",
			"createdAt": "2026-03-18T12:00:00.000Z",
			"updatedAt": "2026-03-18T12:00:00.000Z",
		},
	}); err != nil {
		return err
	}

	invalidResult := c.Handler(TaskListInput{})
	if invalidResult.Success {
		return fmt.Errorf("test: invalid persisted records must return failure")
	}

	return nil
}

func (c *API) validate(input TaskListInput) error {
	if err := c.domainCase.Validate(input); err != nil {
		return &shared.AppCaseError{
			Code:    "VALIDATION_FAILED",
			Message: err.Error(),
		}
	}

	return nil
}

func (c *API) service(_ TaskListInput) (TaskListOutput, error) {
	taskStore, err := c.resolveTaskStore()
	if err != nil {
		return TaskListOutput{}, err
	}

	records, err := taskStore.Read()
	if err != nil {
		return TaskListOutput{}, err
	}

	tasks := make([]Task, 0, len(records))
	for index, record := range records {
		task, err := decodeTask(record)
		if err != nil {
			return TaskListOutput{}, &shared.AppCaseError{
				Code:    "INTERNAL",
				Message: fmt.Sprintf("task_list.persisted_tasks[%d]: %s", index, err.Error()),
			}
		}

		if err := c.domainCase.ValidateTask(task); err != nil {
			return TaskListOutput{}, &shared.AppCaseError{
				Code:    "INTERNAL",
				Message: err.Error(),
			}
		}

		tasks = append(tasks, task)
	}

	output := TaskListOutput{
		Tasks: c.domainCase.SortTasks(tasks),
	}
	if err := c.domainCase.ValidateOutput(output); err != nil {
		return TaskListOutput{}, err
	}

	return output, nil
}

func (c *API) resolveTaskStore() (TaskStore, error) {
	if c.Ctx == nil || c.Ctx.Extra == nil {
		return nil, &shared.AppCaseError{Code: "INTERNAL", Message: "task_list requires a configured taskStore provider"}
	}

	providers, ok := c.Ctx.Extra["providers"].(shared.Dict)
	if !ok {
		return nil, &shared.AppCaseError{Code: "INTERNAL", Message: "task_list requires a configured taskStore provider"}
	}

	taskStore, ok := providers["taskStore"].(TaskStore)
	if !ok || taskStore == nil {
		return nil, &shared.AppCaseError{Code: "INTERNAL", Message: "task_list requires a configured taskStore provider"}
	}

	return taskStore, nil
}

func (c *API) failure(code string, err error, statusCode int) core.ApiResponse[TaskListOutput] {
	appErr := shared.ToAppError(&shared.AppCaseError{
		Code:    code,
		Message: err.Error(),
	}, code)

	return core.ApiResponse[TaskListOutput]{
		AppResult: shared.AppResult[TaskListOutput]{
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
	default:
		return 500
	}
}

func decodeTask(value any) (Task, error) {
	var task Task
	encoded, err := json.Marshal(value)
	if err != nil {
		return task, err
	}

	if err := json.Unmarshal(encoded, &task); err != nil {
		return task, err
	}

	return task, nil
}

func mustTaskRecord(task Task) map[string]any {
	record, _ := json.Marshal(task)
	decoded := map[string]any{}
	_ = json.Unmarshal(record, &decoded)
	return decoded
}
