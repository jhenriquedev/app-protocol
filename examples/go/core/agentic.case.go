package core

import (
	"fmt"

	"app-protocol/examples/go/core/shared"
)

type AgenticContext struct {
	shared.AppBaseContext
	Cases    shared.Dict
	Packages shared.Dict
	MCP      any
	Extra    shared.Dict
}

type AgenticDiscovery struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Category     string   `json:"category,omitempty"`
	Tags         []string `json:"tags,omitempty"`
	Aliases      []string `json:"aliases,omitempty"`
	Capabilities []string `json:"capabilities,omitempty"`
	Intents      []string `json:"intents,omitempty"`
}

type AgenticExecutionContext struct {
	RequiresAuth   bool     `json:"requiresAuth,omitempty"`
	RequiresTenant bool     `json:"requiresTenant,omitempty"`
	Dependencies   []string `json:"dependencies,omitempty"`
	Preconditions  []string `json:"preconditions,omitempty"`
	Constraints    []string `json:"constraints,omitempty"`
	Notes          []string `json:"notes,omitempty"`
}

type AgenticPrompt struct {
	Purpose         string   `json:"purpose"`
	WhenToUse       []string `json:"whenToUse,omitempty"`
	WhenNotToUse    []string `json:"whenNotToUse,omitempty"`
	Constraints     []string `json:"constraints,omitempty"`
	ReasoningHints  []string `json:"reasoningHints,omitempty"`
	ExpectedOutcome string   `json:"expectedOutcome,omitempty"`
}

type AgenticToolContract struct {
	Name                 string                                            `json:"name"`
	Description          string                                            `json:"description"`
	InputSchema          shared.AppSchema                                  `json:"inputSchema"`
	OutputSchema         shared.AppSchema                                  `json:"outputSchema"`
	IsMutating           bool                                              `json:"isMutating,omitempty"`
	RequiresConfirmation bool                                              `json:"requiresConfirmation,omitempty"`
	Execute              func(input any, ctx *AgenticContext) (any, error) `json:"-"`
}

type AgenticMcpContract struct {
	Enabled     bool        `json:"enabled"`
	Name        string      `json:"name,omitempty"`
	Title       string      `json:"title,omitempty"`
	Description string      `json:"description,omitempty"`
	Metadata    shared.Dict `json:"metadata,omitempty"`
}

type RagResource struct {
	Kind        string `json:"kind"`
	Ref         string `json:"ref"`
	Description string `json:"description,omitempty"`
}

type AgenticRagContract struct {
	Topics    []string      `json:"topics,omitempty"`
	Resources []RagResource `json:"resources,omitempty"`
	Hints     []string      `json:"hints,omitempty"`
	Scope     string        `json:"scope,omitempty"`
	Mode      string        `json:"mode,omitempty"`
}

type AgenticPolicy struct {
	RequireConfirmation bool     `json:"requireConfirmation,omitempty"`
	RiskLevel           string   `json:"riskLevel,omitempty"`
	ExecutionMode       string   `json:"executionMode,omitempty"`
	Limits              []string `json:"limits,omitempty"`
}

type AgenticExample struct {
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	Input       any      `json:"input"`
	Output      any      `json:"output,omitempty"`
	Notes       []string `json:"notes,omitempty"`
}

type AgenticDefinition struct {
	Discovery AgenticDiscovery        `json:"discovery"`
	Context   AgenticExecutionContext `json:"context"`
	Prompt    AgenticPrompt           `json:"prompt"`
	Tool      AgenticToolContract     `json:"tool"`
	MCP       *AgenticMcpContract     `json:"mcp,omitempty"`
	RAG       *AgenticRagContract     `json:"rag,omitempty"`
	Policy    *AgenticPolicy          `json:"policy,omitempty"`
	Examples  []AgenticExample        `json:"examples,omitempty"`
}

type AgenticCaseSupport struct {
	Ctx *AgenticContext
}

func (a *AgenticCaseSupport) Test() error {
	return nil
}

func ValidateAgenticDefinition(def AgenticDefinition) error {
	if def.Discovery.Name == "" {
		return fmt.Errorf("agentic definition requires discovery.name")
	}

	if def.Discovery.Description == "" {
		return fmt.Errorf("agentic definition requires discovery.description")
	}

	if def.Prompt.Purpose == "" {
		return fmt.Errorf("agentic definition requires prompt.purpose")
	}

	if def.Tool.Name == "" {
		return fmt.Errorf("agentic definition requires tool.name")
	}

	if def.Tool.Description == "" {
		return fmt.Errorf("agentic definition requires tool.description")
	}

	if len(def.Tool.InputSchema) == 0 {
		return fmt.Errorf("agentic definition requires tool.inputSchema")
	}

	if len(def.Tool.OutputSchema) == 0 {
		return fmt.Errorf("agentic definition requires tool.outputSchema")
	}

	if def.Tool.Execute == nil {
		return fmt.Errorf("agentic definition requires tool.execute")
	}

	return nil
}
