package task_list

import (
	"encoding/json"
	"fmt"
	"sort"
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

type TaskListInput struct{}

type TaskListOutput struct {
	Tasks []Task `json:"tasks"`
}

type Domain struct {
	core.DomainCaseSupport
}

func NewDomain() *Domain {
	return &Domain{}
}

func (d *Domain) CaseName() string {
	return "task_list"
}

func (d *Domain) Description() string {
	return "Lists persisted task cards for board rendering."
}

func (d *Domain) InputSchema() core.AppSchema {
	return core.AppSchema{
		"type":                 "object",
		"properties":           map[string]any{},
		"additionalProperties": false,
	}
}

func (d *Domain) OutputSchema() core.AppSchema {
	return core.AppSchema{
		"type": "object",
		"properties": map[string]any{
			"tasks": map[string]any{
				"type": "array",
				"items": map[string]any{
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
		},
		"required":             []string{"tasks"},
		"additionalProperties": false,
	}
}

func (d *Domain) ParseInput(value any) (TaskListInput, error) {
	if value == nil {
		return TaskListInput{}, nil
	}

	record, ok := value.(map[string]any)
	if !ok {
		encoded, err := json.Marshal(value)
		if err != nil {
			return TaskListInput{}, fmt.Errorf("input must be an object")
		}

		if err := json.Unmarshal(encoded, &record); err != nil {
			return TaskListInput{}, fmt.Errorf("input must be an object")
		}
	}

	if len(record) > 0 {
		return TaskListInput{}, fmt.Errorf("task_list does not accept filters in v1")
	}

	return TaskListInput{}, nil
}

func (d *Domain) Validate(_ TaskListInput) error {
	return nil
}

func (d *Domain) ValidateOutput(output TaskListOutput) error {
	for index, task := range output.Tasks {
		if err := d.ValidateTask(task); err != nil {
			return fmt.Errorf("task_list.output.tasks[%d]: %w", index, err)
		}
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

func (d *Domain) Invariants() []string {
	return []string{
		"Only todo, doing, and done are valid task statuses.",
		"Listing tasks never mutates the persisted store.",
		"The response order is deterministic for the same persisted dataset.",
	}
}

func (d *Domain) Examples() []core.DomainExample {
	return []core.DomainExample{
		{
			Name:        "empty_board",
			Description: "No persisted tasks yet.",
			Input:       TaskListInput{},
			Output: TaskListOutput{
				Tasks: []Task{},
			},
		},
		{
			Name:        "board_with_cards",
			Description: "Returns tasks already persisted in the board.",
			Input:       TaskListInput{},
			Output: TaskListOutput{
				Tasks: []Task{
					{
						ID:        "task_002",
						Title:     "Prepare release notes",
						Status:    TaskStatusTodo,
						CreatedAt: "2026-03-18T12:10:00.000Z",
						UpdatedAt: "2026-03-18T12:10:00.000Z",
					},
					{
						ID:          "task_001",
						Title:       "Ship the Go example",
						Description: "Wire the APP cases in the portal.",
						Status:      TaskStatusDoing,
						CreatedAt:   "2026-03-18T12:00:00.000Z",
						UpdatedAt:   "2026-03-18T12:30:00.000Z",
					},
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

func (d *Domain) SortTasks(tasks []Task) []Task {
	sorted := append([]Task(nil), tasks...)
	sort.SliceStable(sorted, func(left int, right int) bool {
		return sorted[left].CreatedAt > sorted[right].CreatedAt
	})
	return sorted
}

func (d *Domain) Test() error {
	if _, err := d.ParseInput(map[string]any{"status": "todo"}); err == nil {
		return fmt.Errorf("test: task_list input must reject filters")
	}

	example, ok := d.Examples()[1].Output.(TaskListOutput)
	if !ok {
		return fmt.Errorf("test: board_with_cards example must exist")
	}

	if err := d.ValidateOutput(example); err != nil {
		return err
	}

	if err := d.ValidateOutput(TaskListOutput{
		Tasks: []Task{
			{
				ID:        "bad",
				Title:     "Invalid task",
				Status:    "invalid",
				CreatedAt: "2026-03-18T12:00:00.000Z",
				UpdatedAt: "2026-03-18T12:00:00.000Z",
			},
		},
	}); err == nil {
		return fmt.Errorf("test: validateOutput must reject invalid task status")
	}

	return nil
}
