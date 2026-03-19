package task_move

import (
	"encoding/json"
	"fmt"
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

func (c *API) Handler(input TaskMoveInput) core.ApiResponse[TaskMoveOutput] {
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
		Method: "PATCH",
		Path:   "/tasks/:taskId/status",
		Handler: func(request core.RouteRequest) (any, error) {
			bodyRecord, _ := request.Body.(map[string]any)
			if bodyRecord == nil {
				bodyRecord = map[string]any{}
			}
			bodyRecord["taskId"] = request.Params["taskId"]

			parsed, err := c.domainCase.ParseInput(bodyRecord)
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

	if err := store.Write([]map[string]any{
		mustTaskRecord(Task{
			ID:        "task_001",
			Title:     "Ship the Go example",
			Status:    TaskStatusTodo,
			CreatedAt: "2026-03-18T12:00:00.000Z",
			UpdatedAt: "2026-03-18T12:00:00.000Z",
		}),
	}); err != nil {
		return err
	}

	movedResult := c.Handler(TaskMoveInput{
		TaskID:       "task_001",
		TargetStatus: TaskStatusDoing,
	})
	if !movedResult.Success || movedResult.Data == nil {
		return fmt.Errorf("test: move should return success")
	}

	if movedResult.Data.Task.Status != TaskStatusDoing {
		return fmt.Errorf("test: task status must change to doing")
	}

	persisted, err := store.Read()
	if err != nil {
		return err
	}

	task, err := decodeTask(persisted[0])
	if err != nil {
		return err
	}

	if task.Status != TaskStatusDoing {
		return fmt.Errorf("test: moved status must persist")
	}

	idempotentResult := c.Handler(TaskMoveInput{
		TaskID:       "task_001",
		TargetStatus: TaskStatusDoing,
	})
	if !idempotentResult.Success || idempotentResult.Data == nil {
		return fmt.Errorf("test: idempotent move should still succeed")
	}

	notFoundResult := c.Handler(TaskMoveInput{
		TaskID:       "missing",
		TargetStatus: TaskStatusDone,
	})
	if notFoundResult.Success || notFoundResult.StatusCode != 404 {
		return fmt.Errorf("test: missing task must return NOT_FOUND")
	}

	return nil
}

func (c *API) validate(input TaskMoveInput) error {
	if err := c.domainCase.Validate(input); err != nil {
		return &shared.AppCaseError{
			Code:    "VALIDATION_FAILED",
			Message: err.Error(),
		}
	}

	return nil
}

func (c *API) service(input TaskMoveInput) (TaskMoveOutput, error) {
	taskStore, err := c.resolveTaskStore()
	if err != nil {
		return TaskMoveOutput{}, err
	}

	var output TaskMoveOutput
	var previousStatus TaskStatus

	if _, err := taskStore.Update(func(current []map[string]any) ([]map[string]any, error) {
		index := -1
		var currentTask Task
		for candidateIndex, record := range current {
			task, decodeErr := decodeTask(record)
			if decodeErr != nil {
				return nil, &shared.AppCaseError{
					Code:    "INTERNAL",
					Message: decodeErr.Error(),
				}
			}
			if task.ID == input.TaskID {
				index = candidateIndex
				currentTask = task
				break
			}
		}

		if index < 0 {
			return nil, &shared.AppCaseError{
				Code:    "NOT_FOUND",
				Message: fmt.Sprintf("Task %s was not found", input.TaskID),
			}
		}

		if currentTask.Status == input.TargetStatus {
			output = TaskMoveOutput{Task: currentTask}
			return current, nil
		}

		previousStatus = currentTask.Status
		updatedTask := currentTask
		updatedTask.Status = input.TargetStatus
		updatedTask.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
		output = TaskMoveOutput{Task: updatedTask}

		next := append([]map[string]any(nil), current...)
		next[index] = mustTaskRecord(updatedTask)
		return next, nil
	}); err != nil {
		return TaskMoveOutput{}, err
	}

	if previousStatus != "" && c.Ctx.Logger != nil {
		c.Ctx.Logger.Info("task_move: task status updated", map[string]any{
			"taskId": output.Task.ID,
			"from":   previousStatus,
			"to":     output.Task.Status,
		})
	}

	if err := c.domainCase.ValidateOutput(output); err != nil {
		return TaskMoveOutput{}, err
	}

	return output, nil
}

func (c *API) resolveTaskStore() (TaskStore, error) {
	if c.Ctx == nil || c.Ctx.Extra == nil {
		return nil, &shared.AppCaseError{Code: "INTERNAL", Message: "task_move requires a configured taskStore provider"}
	}

	providers, ok := c.Ctx.Extra["providers"].(shared.Dict)
	if !ok {
		return nil, &shared.AppCaseError{Code: "INTERNAL", Message: "task_move requires a configured taskStore provider"}
	}

	taskStore, ok := providers["taskStore"].(TaskStore)
	if !ok || taskStore == nil {
		return nil, &shared.AppCaseError{Code: "INTERNAL", Message: "task_move requires a configured taskStore provider"}
	}

	return taskStore, nil
}

func (c *API) failure(code string, err error, statusCode int) core.ApiResponse[TaskMoveOutput] {
	appErr := shared.ToAppError(&shared.AppCaseError{
		Code:    code,
		Message: err.Error(),
	}, code)

	return core.ApiResponse[TaskMoveOutput]{
		AppResult: shared.AppResult[TaskMoveOutput]{
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
