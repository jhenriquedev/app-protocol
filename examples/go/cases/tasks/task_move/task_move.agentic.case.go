package task_move

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
		Tags:         []string{"tasks", "move", "status"},
		Aliases:      []string{"move_task", "change_task_status", "advance_task"},
		Capabilities: []string{"task_move", "board_mutation"},
		Intents:      []string{"move a task", "change task status", "advance work on the board"},
	}
}

func (a *Agentic) Context() core.AgenticExecutionContext {
	return core.AgenticExecutionContext{
		Dependencies: []string{"task_move.domain", "task_move.api", "task_list.agentic"},
		Preconditions: []string{
			"A concrete taskId and a valid targetStatus are required.",
		},
		Constraints: []string{
			"Use task_list first when the user refers to a task ambiguously.",
			"Execution must delegate to the canonical API surface.",
		},
		Notes: []string{
			"Moving a task is a mutating action and should be confirmed by the host runtime.",
		},
	}
}

func (a *Agentic) Prompt() core.AgenticPrompt {
	return core.AgenticPrompt{
		Purpose: "Move an existing task to todo, doing, or done by task id.",
		WhenToUse: []string{
			"When the user explicitly wants to move an existing task card.",
			"When the user wants to update the progress status of known work.",
		},
		WhenNotToUse: []string{
			"When the user wants to create a task.",
			"When the user has not provided enough information to identify the task.",
		},
		Constraints: []string{
			"Do not invent a taskId.",
			"Require confirmation before mutating the board.",
		},
		ReasoningHints: []string{
			"If the task is ambiguous, list current tasks first and ask the user to confirm the intended card.",
		},
		ExpectedOutcome: "The updated task object with the requested target status persisted.",
	}
}

func (a *Agentic) Tool() core.AgenticToolContract {
	return core.AgenticToolContract{
		Name:                 "task_move",
		Description:          "Move a task through the canonical API execution flow.",
		InputSchema:          a.domainCase.InputSchema(),
		OutputSchema:         a.domainCase.OutputSchema(),
		IsMutating:           true,
		RequiresConfirmation: true,
		Execute: func(input any, ctx *core.AgenticContext) (any, error) {
			handler, err := resolveAPIHandler(ctx, "task_move")
			if err != nil {
				return nil, err
			}

			resultAny, err := handler.HandleAny(input)
			if err != nil {
				return nil, err
			}

			response, ok := resultAny.(core.ApiResponse[TaskMoveOutput])
			if !ok {
				return nil, fmt.Errorf("task_move API returned an unexpected response type")
			}

			if !response.Success || response.Data == nil {
				if response.Error != nil {
					return nil, &shared.AppCaseError{
						Code:    response.Error.Code,
						Message: response.Error.Message,
						Details: response.Error.Details,
					}
				}
				return nil, &shared.AppCaseError{Code: "INTERNAL", Message: "task_move API failed"}
			}

			return *response.Data, nil
		},
	}
}

func (a *Agentic) MCP() *core.AgenticMcpContract {
	return &core.AgenticMcpContract{
		Enabled:     true,
		Name:        "task_move",
		Title:       "Move Task",
		Description: "Move a task between board columns through the canonical APP task_move API flow.",
		Metadata: shared.Dict{
			"category": "tasks",
			"mutating": true,
		},
	}
}

func (a *Agentic) RAG() *core.AgenticRagContract {
	return &core.AgenticRagContract{
		Topics: []string{"task_management", "status_transitions", "board_mutation"},
		Resources: []core.RagResource{
			{
				Kind:        "case",
				Ref:         "tasks/task_move",
				Description: "Canonical board mutation capability for changing task status.",
			},
			{
				Kind:        "case",
				Ref:         "tasks/task_list",
				Description: "Grounding capability used to identify persisted task ids before moving them.",
			},
		},
		Hints: []string{
			"Use task_list to ground ambiguous references before proposing or executing a move.",
			"Preserve explicit confirmation because task_move mutates persisted board state.",
		},
		Scope: "project",
		Mode:  "recommended",
	}
}

func (a *Agentic) Policy() *core.AgenticPolicy {
	return &core.AgenticPolicy{
		RequireConfirmation: true,
		RiskLevel:           "medium",
		ExecutionMode:       "manual-approval",
		Limits: []string{
			"Do not execute a move without explicit confirmation from the host runtime.",
		},
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

	if !definition.Tool.RequiresConfirmation {
		return fmt.Errorf("test: task_move tool must require confirmation")
	}

	if definition.Policy == nil || definition.Policy.ExecutionMode != "manual-approval" {
		return fmt.Errorf("test: task_move should default to manual approval")
	}

	example := a.Examples()[0]
	mock := &mockAPIHandler{
		handle: func(input any) (any, error) {
			output, err := decodeTaskMoveOutput(example.Output)
			if err != nil {
				return nil, err
			}
			return core.ApiResponse[TaskMoveOutput]{
				AppResult: shared.AppResult[TaskMoveOutput]{
					Success: true,
					Data:    &output,
				},
			}, nil
		},
	}

	ctx := &core.AgenticContext{
		Cases: shared.Dict{
			"tasks": shared.Dict{
				"task_move": shared.Dict{
					"api": mock,
				},
			},
		},
	}

	result, err := definition.Tool.Execute(example.Input, ctx)
	if err != nil {
		return err
	}

	output, err := decodeTaskMoveOutput(result)
	if err != nil {
		return err
	}

	if output.Task.Status != TaskStatusDoing {
		return fmt.Errorf("test: task_move tool must return the moved task")
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
		return nil, fmt.Errorf("task_move agentic requires ctx.cases")
	}

	tasks, ok := ctx.Cases["tasks"].(shared.Dict)
	if !ok {
		return nil, fmt.Errorf("task_move agentic requires ctx.cases.tasks")
	}

	caseEntry, ok := tasks[caseName].(shared.Dict)
	if !ok {
		return nil, fmt.Errorf("task_move agentic requires ctx.cases.tasks.%s", caseName)
	}

	handler, ok := caseEntry["api"].(core.APIHandler)
	if !ok {
		return nil, fmt.Errorf("task_move agentic requires ctx.cases.tasks.%s.api", caseName)
	}

	return handler, nil
}
