package task_list

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
		Tags:         []string{"tasks", "listing", "board"},
		Aliases:      []string{"list_board_tasks", "show_board", "inspect_board_state"},
		Capabilities: []string{"task_listing", "board_grounding"},
		Intents:      []string{"list tasks", "show the board", "show current tasks"},
	}
}

func (a *Agentic) Context() core.AgenticExecutionContext {
	return core.AgenticExecutionContext{
		Dependencies: []string{"task_list.domain", "task_list.api"},
		Preconditions: []string{
			"The persisted task store must be readable.",
		},
		Constraints: []string{
			"This capability is read-only.",
			"No filters or pagination are supported in v1.",
		},
		Notes: []string{
			"Use this capability to ground follow-up decisions before mutating the board.",
		},
	}
}

func (a *Agentic) Prompt() core.AgenticPrompt {
	return core.AgenticPrompt{
		Purpose: "List all persisted tasks so an agent can inspect the board state.",
		WhenToUse: []string{
			"When the user asks to see the board or current tasks.",
			"Before moving a task when the user has not provided an exact task identifier.",
		},
		WhenNotToUse: []string{
			"When the user wants to create a new task.",
			"When the user already provided a precise task id for a direct move operation.",
		},
		Constraints: []string{
			"Do not claim support for filters or search in this v1 example.",
		},
		ReasoningHints: []string{
			"Treat task_list as the canonical grounding step before ambiguous task mutations.",
		},
		ExpectedOutcome: "A flat array of task objects ordered by createdAt descending.",
	}
}

func (a *Agentic) Tool() core.AgenticToolContract {
	return core.AgenticToolContract{
		Name:         "task_list",
		Description:  "List tasks through the canonical API execution flow.",
		InputSchema:  a.domainCase.InputSchema(),
		OutputSchema: a.domainCase.OutputSchema(),
		Execute: func(input any, ctx *core.AgenticContext) (any, error) {
			handler, err := resolveAPIHandler(ctx, "task_list")
			if err != nil {
				return nil, err
			}

			resultAny, err := handler.HandleAny(input)
			if err != nil {
				return nil, err
			}

			response, ok := resultAny.(core.ApiResponse[TaskListOutput])
			if !ok {
				return nil, fmt.Errorf("task_list API returned an unexpected response type")
			}

			if !response.Success || response.Data == nil {
				if response.Error != nil {
					return nil, &shared.AppCaseError{
						Code:    response.Error.Code,
						Message: response.Error.Message,
						Details: response.Error.Details,
					}
				}
				return nil, &shared.AppCaseError{Code: "INTERNAL", Message: "task_list API failed"}
			}

			return *response.Data, nil
		},
	}
}

func (a *Agentic) MCP() *core.AgenticMcpContract {
	return &core.AgenticMcpContract{
		Enabled:     true,
		Name:        "task_list",
		Title:       "List Tasks",
		Description: "Inspect the current task board state through the canonical APP task_list API flow.",
		Metadata: shared.Dict{
			"category": "tasks",
			"mutating": false,
		},
	}
}

func (a *Agentic) RAG() *core.AgenticRagContract {
	return &core.AgenticRagContract{
		Topics: []string{"task_management", "board_state", "task_grounding"},
		Resources: []core.RagResource{
			{
				Kind:        "case",
				Ref:         "tasks/task_list",
				Description: "Canonical board-state capability used for grounding agent decisions.",
			},
			{
				Kind:        "case",
				Ref:         "tasks/task_move",
				Description: "Related board mutation capability that depends on accurate task identification.",
			},
			{
				Kind:        "case",
				Ref:         "tasks/task_create",
				Description: "Related board mutation capability that adds new work into the backlog.",
			},
		},
		Hints: []string{
			"Use task_list before ambiguous mutations so the agent grounds itself on persisted ids and statuses.",
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
	}
}

func (a *Agentic) Examples() []core.AgenticExample {
	examples := []core.AgenticExample{}
	for _, example := range a.domainCase.Examples() {
		examples = append(examples, core.AgenticExample{
			Name:        example.Name,
			Description: example.Description,
			Input:       example.Input,
			Output:      example.Output,
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

	if definition.Tool.IsMutating {
		return fmt.Errorf("test: task_list agentic must be read-only")
	}

	if definition.RAG == nil || len(definition.RAG.Resources) == 0 {
		return fmt.Errorf("test: task_list should publish semantic RAG resources")
	}

	example := a.Examples()[1]
	mock := &mockAPIHandler{
		handle: func(input any) (any, error) {
			output, err := decodeTaskListOutput(example.Output)
			if err != nil {
				return nil, err
			}
			return core.ApiResponse[TaskListOutput]{
				AppResult: shared.AppResult[TaskListOutput]{
					Success: true,
					Data:    &output,
				},
			}, nil
		},
	}

	ctx := &core.AgenticContext{
		Cases: shared.Dict{
			"tasks": shared.Dict{
				"task_list": shared.Dict{
					"api": mock,
				},
			},
		},
	}

	result, err := definition.Tool.Execute(example.Input, ctx)
	if err != nil {
		return err
	}

	output, err := decodeTaskListOutput(result)
	if err != nil {
		return err
	}

	if len(output.Tasks) == 0 {
		return fmt.Errorf("test: task_list tool must return the mocked task collection")
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
		return nil, fmt.Errorf("task_list agentic requires ctx.cases")
	}

	tasks, ok := ctx.Cases["tasks"].(shared.Dict)
	if !ok {
		return nil, fmt.Errorf("task_list agentic requires ctx.cases.tasks")
	}

	caseEntry, ok := tasks[caseName].(shared.Dict)
	if !ok {
		return nil, fmt.Errorf("task_list agentic requires ctx.cases.tasks.%s", caseName)
	}

	handler, ok := caseEntry["api"].(core.APIHandler)
	if !ok {
		return nil, fmt.Errorf("task_list agentic requires ctx.cases.tasks.%s.api", caseName)
	}

	return handler, nil
}
