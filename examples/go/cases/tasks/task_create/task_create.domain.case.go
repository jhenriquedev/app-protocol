package task_create

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

type TaskCreateInput struct {
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
}

type TaskCreateOutput struct {
	Task Task `json:"task"`
}

type Domain struct {
	core.DomainCaseSupport
}

func NewDomain() *Domain {
	return &Domain{}
}

func (d *Domain) CaseName() string {
	return "task_create"
}

func (d *Domain) Description() string {
	return "Creates a new task card for the board with an initial todo status."
}

func (d *Domain) InputSchema() core.AppSchema {
	return core.AppSchema{
		"type": "object",
		"properties": map[string]any{
			"title": map[string]any{
				"type":        "string",
				"description": "Visible task title shown on the card.",
			},
			"description": map[string]any{
				"type":        "string",
				"description": "Optional complementary task description.",
			},
		},
		"required":             []string{"title"},
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

func (d *Domain) ParseInput(value any) (TaskCreateInput, error) {
	record, ok := value.(map[string]any)
	if !ok {
		encoded, err := json.Marshal(value)
		if err != nil {
			return TaskCreateInput{}, fmt.Errorf("input must be an object")
		}

		var decoded map[string]any
		if err := json.Unmarshal(encoded, &decoded); err != nil {
			return TaskCreateInput{}, fmt.Errorf("input must be an object")
		}
		record = decoded
	}

	for _, forbiddenField := range []string{"id", "status", "createdAt", "updatedAt"} {
		if _, exists := record[forbiddenField]; exists {
			return TaskCreateInput{}, fmt.Errorf("%s must not be provided by the caller", forbiddenField)
		}
	}

	input := TaskCreateInput{}
	if title, ok := record["title"].(string); ok {
		input.Title = title
	}
	if description, ok := record["description"].(string); ok {
		input.Description = description
	}

	return input, d.Validate(input)
}

func (d *Domain) Validate(input TaskCreateInput) error {
	if strings.TrimSpace(input.Title) == "" {
		return fmt.Errorf("title must not be empty")
	}

	return nil
}

func (d *Domain) ValidateOutput(output TaskCreateOutput) error {
	if strings.TrimSpace(output.Task.ID) == "" {
		return fmt.Errorf("task.id must be a non-empty string")
	}

	if strings.TrimSpace(output.Task.Title) == "" {
		return fmt.Errorf("task.title must be a non-empty string")
	}

	switch output.Task.Status {
	case TaskStatusTodo, TaskStatusDoing, TaskStatusDone:
	default:
		return fmt.Errorf("task.status must be one of todo, doing, done")
	}

	if strings.TrimSpace(output.Task.CreatedAt) == "" {
		return fmt.Errorf("task.createdAt must be a non-empty string")
	}

	if strings.TrimSpace(output.Task.UpdatedAt) == "" {
		return fmt.Errorf("task.updatedAt must be a non-empty string")
	}

	return nil
}

func (d *Domain) Invariants() []string {
	return []string{
		"Every new task starts with status todo.",
		"The backend is the source of truth for task id and timestamps.",
		"createdAt and updatedAt are equal on first creation.",
	}
}

func (d *Domain) Examples() []core.DomainExample {
	return []core.DomainExample{
		{
			Name:        "title_only",
			Description: "Create a task with only the required title.",
			Input: TaskCreateInput{
				Title: "Ship the Go example",
			},
			Output: TaskCreateOutput{
				Task: Task{
					ID:        "task_001",
					Title:     "Ship the Go example",
					Status:    TaskStatusTodo,
					CreatedAt: "2026-03-18T12:00:00.000Z",
					UpdatedAt: "2026-03-18T12:00:00.000Z",
				},
			},
		},
		{
			Name:        "title_and_description",
			Description: "Create a task with an optional description.",
			Input: TaskCreateInput{
				Title:       "Prepare release notes",
				Description: "Summarize the Go APP example scope.",
			},
			Output: TaskCreateOutput{
				Task: Task{
					ID:          "task_002",
					Title:       "Prepare release notes",
					Description: "Summarize the Go APP example scope.",
					Status:      TaskStatusTodo,
					CreatedAt:   "2026-03-18T12:10:00.000Z",
					UpdatedAt:   "2026-03-18T12:10:00.000Z",
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
	definition := d.Definition()
	if definition.CaseName != "task_create" {
		return fmt.Errorf("test: caseName must be task_create")
	}

	if err := d.Validate(TaskCreateInput{
		Title:       "Valid task",
		Description: "Optional text",
	}); err != nil {
		return err
	}

	if _, err := d.ParseInput(map[string]any{
		"title":  "Bad task",
		"status": "todo",
	}); err == nil {
		return fmt.Errorf("test: ParseInput must reject forbidden fields")
	}

	if err := d.Validate(TaskCreateInput{Title: "   "}); err == nil {
		return fmt.Errorf("test: validate must reject blank title")
	}

	for _, example := range d.Examples() {
		input, ok := example.Input.(TaskCreateInput)
		if !ok {
			return fmt.Errorf("test: example input must be TaskCreateInput")
		}

		output, ok := example.Output.(TaskCreateOutput)
		if !ok {
			return fmt.Errorf("test: example output must be TaskCreateOutput")
		}

		if err := d.Validate(input); err != nil {
			return err
		}

		if err := d.ValidateOutput(output); err != nil {
			return err
		}

		if output.Task.Status != TaskStatusTodo {
			return fmt.Errorf("test: example output must start in todo")
		}
	}

	return nil
}
