package task_move

import (
	"encoding/json"
	"fmt"
	"strings"

	"app-protocol/examples/go/core"
)

type TaskStatus string

const (
	TaskStatusTodo  TaskStatus = "todo"
	TaskStatusDoing TaskStatus = "doing"
	TaskStatusDone  TaskStatus = "done"
)

type Task struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description,omitempty"`
	Status      TaskStatus `json:"status"`
	CreatedAt   string     `json:"createdAt"`
	UpdatedAt   string     `json:"updatedAt"`
}

type TaskMoveInput struct {
	TaskID       string     `json:"taskId"`
	TargetStatus TaskStatus `json:"targetStatus"`
}

type TaskMoveOutput struct {
	Task Task `json:"task"`
}

type Domain struct {
	core.DomainCaseSupport
}

func NewDomain() *Domain {
	return &Domain{}
}

func (d *Domain) CaseName() string {
	return "task_move"
}

func (d *Domain) Description() string {
	return "Moves an existing task card to another board column."
}

func (d *Domain) InputSchema() core.AppSchema {
	return core.AppSchema{
		"type": "object",
		"properties": map[string]any{
			"taskId": map[string]any{
				"type":        "string",
				"description": "Identifier of the task that will be moved.",
			},
			"targetStatus": map[string]any{
				"type":        "string",
				"description": "Destination board column for the task.",
				"enum":        []string{"todo", "doing", "done"},
			},
		},
		"required":             []string{"taskId", "targetStatus"},
		"additionalProperties": false,
	}
}

func (d *Domain) OutputSchema() core.AppSchema {
	return core.AppSchema{
		"type": "object",
		"properties": map[string]any{
			"task": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"id":          map[string]any{"type": "string"},
					"title":       map[string]any{"type": "string"},
					"description": map[string]any{"type": "string"},
					"status": map[string]any{
						"type": "string",
						"enum": []string{"todo", "doing", "done"},
					},
					"createdAt": map[string]any{"type": "string"},
					"updatedAt": map[string]any{"type": "string"},
				},
				"required":             []string{"id", "title", "status", "createdAt", "updatedAt"},
				"additionalProperties": false,
			},
		},
		"required":             []string{"task"},
		"additionalProperties": false,
	}
}

func (d *Domain) ParseInput(value any) (TaskMoveInput, error) {
	record, ok := value.(map[string]any)
	if !ok {
		encoded, err := json.Marshal(value)
		if err != nil {
			return TaskMoveInput{}, fmt.Errorf("input must be an object")
		}
		if err := json.Unmarshal(encoded, &record); err != nil {
			return TaskMoveInput{}, fmt.Errorf("input must be an object")
		}
	}

	input := TaskMoveInput{}
	if taskID, ok := record["taskId"].(string); ok {
		input.TaskID = taskID
	}
	if targetStatus, ok := record["targetStatus"].(string); ok {
		input.TargetStatus = TaskStatus(targetStatus)
	}

	return input, d.Validate(input)
}

func (d *Domain) Validate(input TaskMoveInput) error {
	if strings.TrimSpace(input.TaskID) == "" {
		return fmt.Errorf("taskId is required")
	}

	switch input.TargetStatus {
	case TaskStatusTodo, TaskStatusDoing, TaskStatusDone:
	default:
		return fmt.Errorf("targetStatus must be one of todo, doing, done")
	}

	return nil
}

func (d *Domain) ValidateTask(task Task) error {
	if strings.TrimSpace(task.ID) == "" {
		return fmt.Errorf("id must be a non-empty string")
	}

	if strings.TrimSpace(task.Title) == "" {
		return fmt.Errorf("title must be a non-empty string")
	}

	switch task.Status {
	case TaskStatusTodo, TaskStatusDoing, TaskStatusDone:
	default:
		return fmt.Errorf("status must be one of todo, doing, done")
	}

	if strings.TrimSpace(task.CreatedAt) == "" {
		return fmt.Errorf("createdAt must be a non-empty string")
	}

	if strings.TrimSpace(task.UpdatedAt) == "" {
		return fmt.Errorf("updatedAt must be a non-empty string")
	}

	return nil
}

func (d *Domain) ValidateOutput(output TaskMoveOutput) error {
	return d.ValidateTask(output.Task)
}

func (d *Domain) Invariants() []string {
	return []string{
		"Moving a task never changes its identity.",
		"A move only updates status and, when applicable, updatedAt.",
		"Moving to the same status is idempotent and returns the unchanged task.",
	}
}

func (d *Domain) Examples() []core.DomainExample {
	return []core.DomainExample{
		{
			Name:        "move_todo_to_doing",
			Description: "A task leaves todo and enters doing.",
			Input: TaskMoveInput{
				TaskID:       "task_001",
				TargetStatus: TaskStatusDoing,
			},
			Output: TaskMoveOutput{
				Task: Task{
					ID:        "task_001",
					Title:     "Ship the Go example",
					Status:    TaskStatusDoing,
					CreatedAt: "2026-03-18T12:00:00.000Z",
					UpdatedAt: "2026-03-18T12:20:00.000Z",
				},
			},
		},
		{
			Name:        "idempotent_move",
			Description: "Moving to the same status keeps the task unchanged.",
			Input: TaskMoveInput{
				TaskID:       "task_002",
				TargetStatus: TaskStatusDone,
			},
			Output: TaskMoveOutput{
				Task: Task{
					ID:        "task_002",
					Title:     "Prepare release notes",
					Status:    TaskStatusDone,
					CreatedAt: "2026-03-18T12:10:00.000Z",
					UpdatedAt: "2026-03-18T12:10:00.000Z",
				},
			},
		},
	}
}

func (d *Domain) Definition() core.DomainDefinition {
	return core.DomainDefinition{
		CaseName:     d.CaseName(),
		Description:  d.Description(),
		InputSchema:  d.InputSchema(),
		OutputSchema: d.OutputSchema(),
		Invariants:   d.Invariants(),
		ValueObjects: d.ValueObjects(),
		Enums:        d.Enums(),
		Examples:     d.Examples(),
	}
}

func (d *Domain) Test() error {
	if err := d.Validate(TaskMoveInput{
		TaskID:       "task_001",
		TargetStatus: TaskStatusDoing,
	}); err != nil {
		return err
	}

	if err := d.Validate(TaskMoveInput{
		TaskID:       "",
		TargetStatus: TaskStatusDoing,
	}); err == nil {
		return fmt.Errorf("test: validate must reject empty taskId")
	}

	if err := d.Validate(TaskMoveInput{
		TaskID:       "task_001",
		TargetStatus: "invalid",
	}); err == nil {
		return fmt.Errorf("test: validate must reject invalid targetStatus")
	}

	if err := d.ValidateOutput(TaskMoveOutput{
		Task: Task{
			ID:        "task_001",
			Title:     "Valid task",
			Status:    TaskStatusDoing,
			CreatedAt: "2026-03-18T12:00:00.000Z",
			UpdatedAt: "2026-03-18T12:20:00.000Z",
		},
	}); err != nil {
		return err
	}

	return nil
}
