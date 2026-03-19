package task_create

import (
	"fmt"

	"app-protocol/examples/go/core"
	"app-protocol/examples/go/core/shared"
)

type Agentic struct {
	support    core.AgenticCaseSupport
	domainCase *Domain
}

func NewAgentic(ctx *core.AgenticContext) *Agentic {
	return &Agentic{
		support:    core.AgenticCaseSupport{Ctx: ctx},
		domainCase: NewDomain(),
	}
}

func (a *Agentic) Discovery() core.AgenticDiscovery {
	return core.AgenticDiscovery{
		Name:         a.domainCase.CaseName(),
		Description:  a.domainCase.Description(),
		Category:     "tasks",
		Tags:         []string{"tasks", "creation", "board"},
		Aliases:      []string{"create_task", "new_task_card", "add_board_task"},
		Capabilities: []string{"task_creation"},
		Intents:      []string{"create a task", "add a task", "add work to the board"},
	}
}

func (a *Agentic) Context() core.AgenticExecutionContext {
	return core.AgenticExecutionContext{
		Dependencies: []string{"task_create.domain", "task_create.api"},
		Preconditions: []string{
			"A non-empty title must be provided.",
		},
		Constraints: []string{
			"The caller must not provide id, status, createdAt, or updatedAt.",
			"Execution must delegate to the canonical API surface.",
			"Descriptions stay optional and should only be passed when the user supplied them.",
		},
		Notes: []string{
			"New tasks always start in todo.",
			"The backend is the source of truth for identifiers and timestamps.",
		},
	}
}

func (a *Agentic) Prompt() core.AgenticPrompt {
	return core.AgenticPrompt{
		Purpose: "Create a new task with a required title and an optional description.",
		WhenToUse: []string{
			"When the user asks to create or add a new task card.",
			"When new work needs to be placed into the board backlog.",
		},
		WhenNotToUse: []string{
			"When the user wants to inspect existing tasks.",
			"When the user wants to move an existing task between columns.",
		},
		Constraints: []string{
			"Ask for a title if the user did not provide one.",
			"Do not invent backend-controlled fields.",
		},
		ReasoningHints: []string{
			"Treat description as optional and pass it only when the user gave enough detail.",
			"Prefer concise titles because they are displayed directly on the board card.",
		},
		ExpectedOutcome: "A created task object with status todo and backend-generated identity fields.",
	}
}

func (a *Agentic) Tool() core.AgenticToolContract {
	return core.AgenticToolContract{
		Name:         "task_create",
		Description:  "Create a task through the canonical API execution flow.",
		InputSchema:  a.domainCase.InputSchema(),
		OutputSchema: a.domainCase.OutputSchema(),
		IsMutating:   true,
		Execute: func(input any, ctx *core.AgenticContext) (any, error) {
			handler, err := resolveAPIHandler(ctx, "task_create")
			if err != nil {
				return nil, err
			}

			resultAny, err := handler.HandleAny(input)
			if err != nil {
				return nil, err
			}

			response, ok := resultAny.(core.ApiResponse[TaskCreateOutput])
			if !ok {
				return nil, fmt.Errorf("task_create API returned an unexpected response type")
			}

			if !response.Success || response.Data == nil {
				return nil, shared.ToAppCaseError(
					&shared.AppCaseError{
						Code:    response.Error.Code,
						Message: response.Error.Message,
						Details: response.Error.Details,
					},
					"task_create API failed",
					"INTERNAL",
					nil,
				)
			}

			return *response.Data, nil
		},
	}
}

func (a *Agentic) MCP() *core.AgenticMcpContract {
	return &core.AgenticMcpContract{
		Enabled:     true,
		Name:        "task_create",
		Title:       "Create Task",
		Description: "Create a board task through the canonical APP task_create API flow.",
		Metadata: shared.Dict{
			"category": "tasks",
			"mutating": true,
		},
	}
}

func (a *Agentic) RAG() *core.AgenticRagContract {
	return &core.AgenticRagContract{
		Topics: []string{"task_management", "board_backlog", "task_creation"},
		Resources: []core.RagResource{
			{
				Kind:        "case",
				Ref:         "tasks/task_create",
				Description: "Canonical task creation capability for new board work.",
			},
			{
				Kind:        "case",
				Ref:         "tasks/task_list",
				Description: "Board grounding capability for inspecting current tasks before adding related work.",
			},
		},
		Hints: []string{
			"Prefer the canonical backlog language used by the board.",
			"Keep task titles concise because they render directly on cards.",
		},
		Scope: "project",
		Mode:  "recommended",
	}
}

func (a *Agentic) Policy() *core.AgenticPolicy {
	return &core.AgenticPolicy{
		RequireConfirmation: false,
		RiskLevel:           "low",
		ExecutionMode:       "direct-execution",
		Limits:              []string{"Use only for explicit task-creation intent."},
	}
}

func (a *Agentic) Examples() []core.AgenticExample {
	var examples []core.AgenticExample
	for _, example := range a.domainCase.Examples() {
		examples = append(examples, core.AgenticExample{
			Name:        example.Name,
			Description: example.Description,
			Input:       example.Input,
			Output:      example.Output,
			Notes:       example.Notes,
		})
	}

	return examples
}

func (a *Agentic) Definition() core.AgenticDefinition {
	return core.AgenticDefinition{
		Discovery: a.Discovery(),
		Context:   a.Context(),
		Prompt:    a.Prompt(),
		Tool:      a.Tool(),
		MCP:       a.MCP(),
		RAG:       a.RAG(),
		Policy:    a.Policy(),
		Examples:  a.Examples(),
	}
}

func (a *Agentic) Test() error {
	definition := a.Definition()
	if err := core.ValidateAgenticDefinition(definition); err != nil {
		return err
	}

	if !definition.Tool.IsMutating {
		return fmt.Errorf("test: task_create agentic must be mutating")
	}

	if definition.Policy == nil || definition.Policy.ExecutionMode != "direct-execution" {
		return fmt.Errorf("test: task_create should default to direct execution")
	}

	example := a.Examples()[0]
	mock := &mockAPIHandler{
		handle: func(input any) (any, error) {
			output, err := decodeTaskCreateOutput(example.Output)
			if err != nil {
				return nil, err
			}

			return core.ApiResponse[TaskCreateOutput]{
				AppResult: shared.AppResult[TaskCreateOutput]{
					Success: true,
					Data:    &output,
				},
			}, nil
		},
	}

	ctx := &core.AgenticContext{
		Cases: shared.Dict{
			"tasks": shared.Dict{
				"task_create": shared.Dict{
					"api": mock,
				},
			},
		},
	}

	result, err := definition.Tool.Execute(example.Input, ctx)
	if err != nil {
		return err
	}

	output, err := decodeTaskCreateOutput(result)
	if err != nil {
		return err
	}

	if output.Task.Status != TaskStatusTodo {
		return fmt.Errorf("test: task_create tool must return a todo task")
	}

	return nil
}

type mockAPIHandler struct {
	handle func(input any) (any, error)
}

func (m *mockAPIHandler) HandleAny(input any) (any, error) {
	return m.handle(input)
}

func resolveAPIHandler(ctx *core.AgenticContext, caseName string) (core.APIHandler, error) {
	if ctx == nil || ctx.Cases == nil {
		return nil, fmt.Errorf("task_create agentic requires ctx.cases")
	}

	tasks, ok := ctx.Cases["tasks"].(shared.Dict)
	if !ok {
		return nil, fmt.Errorf("task_create agentic requires ctx.cases.tasks")
	}

	caseEntry, ok := tasks[caseName].(shared.Dict)
	if !ok {
		return nil, fmt.Errorf("task_create agentic requires ctx.cases.tasks.%s", caseName)
	}

	handler, ok := caseEntry["api"].(core.APIHandler)
	if !ok {
		return nil, fmt.Errorf("task_create agentic requires ctx.cases.tasks.%s.api", caseName)
	}

	return handler, nil
}
