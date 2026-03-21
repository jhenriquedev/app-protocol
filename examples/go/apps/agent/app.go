package agent

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sort"
	"strings"

	"app-protocol/examples/go/core"
	"app-protocol/examples/go/core/shared"
)

const (
	AppVersion           = "1.1.1"
	MCPProtocolVersion   = "2025-11-25"
	MCPLegacyVersion     = "2025-06-18"
	AgentServerName      = "go-task-board-agent"
	systemPromptResource = "app://agent/system/prompt"
)

type ParentExecutionContext struct {
	CorrelationID string
	TenantID      string
	UserID        string
	Config        shared.Dict
	Confirmed     bool
	MCP           *shared.AppMcpRequestContext
}

type ExecuteEnvelope struct {
	Input     any
	Confirmed bool
}

type App struct {
	registry *Registry
	logger   shared.AppLogger
}

type apiExecutionProxy struct {
	factory shared.ContextualFactory
	ctx     *core.ApiContext
}

type mcpServer struct {
	app *App
}

func Bootstrap(config Config) *App {
	return &App{
		registry: CreateRegistry(config),
		logger:   shared.DefaultLogger{Prefix: "[agent]"},
	}
}

func (a *App) Registry() *Registry {
	return a.registry
}

func (p *apiExecutionProxy) HandleAny(input any) (any, error) {
	instance, ok := p.factory(p.ctx).(core.APIHandler)
	if !ok {
		return nil, fmt.Errorf("apps/agent requires API surfaces to implement core.APIHandler")
	}
	return instance.HandleAny(input)
}

func (a *App) buildAPIContext(parent *ParentExecutionContext) *core.ApiContext {
	return &core.ApiContext{
		AppBaseContext: shared.AppBaseContext{
			CorrelationID: chooseString(parentCorrelation(parent), shared.NewID()),
			ExecutionID:   shared.NewID(),
			TenantID:      chooseString(parentTenant(parent), ""),
			UserID:        chooseString(parentUser(parent), ""),
			Logger:        a.logger,
			Config:        chooseDict(parentConfig(parent)),
		},
		Packages: a.registry._packages,
		Extra: shared.Dict{
			"providers": a.registry._providers,
		},
	}
}

func (a *App) materializeAPICases(apiContext *core.ApiContext) shared.Dict {
	cases := shared.Dict{}
	for domainName, domainCases := range a.registry._cases {
		domainEntry := shared.Dict{}
		for caseName, surfaces := range domainCases {
			surfaceEntry := shared.Dict{}
			if surfaces.API != nil {
				surfaceEntry["api"] = &apiExecutionProxy{
					factory: surfaces.API,
					ctx:     apiContext,
				}
			}
			domainEntry[caseName] = surfaceEntry
		}
		cases[domainName] = domainEntry
	}
	return cases
}

func (a *App) CreateAPIContext(parent *ParentExecutionContext) *core.ApiContext {
	context := a.buildAPIContext(parent)
	context.Cases = a.materializeAPICases(context)
	return context
}

func (a *App) CreateAgenticContext(parent *ParentExecutionContext) *core.AgenticContext {
	context := &core.AgenticContext{
		AppBaseContext: shared.AppBaseContext{
			CorrelationID: chooseString(parentCorrelation(parent), shared.NewID()),
			ExecutionID:   shared.NewID(),
			TenantID:      chooseString(parentTenant(parent), ""),
			UserID:        chooseString(parentUser(parent), ""),
			Logger:        a.logger,
			Config:        chooseDict(parentConfig(parent)),
		},
		Packages: a.registry._packages,
		MCP: shared.Dict{
			"serverName":      AgentServerName,
			"version":         AppVersion,
			"protocolVersion": MCPProtocolVersion,
			"transport":       parentTransport(parent),
			"sessionId":       parentSessionID(parent),
			"clientInfo":      parentClientInfo(parent),
		},
		Extra: shared.Dict{
			"providers": a.registry._providers,
		},
	}

	apiContext := a.CreateAPIContext(&ParentExecutionContext{
		CorrelationID: context.CorrelationID,
		TenantID:      context.TenantID,
		UserID:        context.UserID,
		Config:        context.Config,
	})
	context.Cases = apiContext.Cases
	return context
}

func (a *App) BuildAgentCatalog(parent *ParentExecutionContext) ([]shared.AgenticCatalogEntry, error) {
	return a.registry.BuildCatalog(a.CreateAgenticContext(parent))
}

func (a *App) ResolveTool(toolName string, parent *ParentExecutionContext) (*shared.AgenticCatalogEntry, error) {
	return a.registry.ResolveTool(strings.TrimSpace(toolName), a.CreateAgenticContext(parent))
}

func (a *App) ExecuteTool(toolName string, input any, parent *ParentExecutionContext) (any, error) {
	entry, err := a.ResolveTool(toolName, parent)
	if err != nil {
		return nil, err
	}
	if entry == nil {
		return nil, &shared.AppCaseError{
			Code:    "NOT_FOUND",
			Message: fmt.Sprintf("Tool %s is not registered in apps/agent", toolName),
		}
	}

	if entry.ExecutionMode == "suggest-only" {
		return nil, &shared.AppCaseError{
			Code:    "EXECUTION_MODE_RESTRICTED",
			Message: fmt.Sprintf("Tool %s cannot execute directly in suggest-only mode", entry.PublishedName),
			Details: shared.Dict{
				"toolName":      entry.PublishedName,
				"executionMode": entry.ExecutionMode,
			},
		}
	}

	if entry.RequiresConfirmation && (parent == nil || !parent.Confirmed) {
		return nil, &shared.AppCaseError{
			Code:    "CONFIRMATION_REQUIRED",
			Message: fmt.Sprintf("Tool %s requires explicit confirmation before execution", entry.PublishedName),
			Details: shared.Dict{
				"toolName":      entry.PublishedName,
				"executionMode": entry.ExecutionMode,
			},
		}
	}

	definition := definitionOf(*entry)
	return definition.Tool.Execute(input, a.CreateAgenticContext(parent))
}

func (a *App) BuildSystemPrompt(parent *ParentExecutionContext) (string, error) {
	catalog, err := a.BuildAgentCatalog(parent)
	if err != nil {
		return "", err
	}

	sort.SliceStable(catalog, func(left int, right int) bool {
		return catalog[left].PublishedName < catalog[right].PublishedName
	})

	confirmationTools := []string{}
	suggestOnlyTools := []string{}
	for _, entry := range catalog {
		if entry.RequiresConfirmation {
			confirmationTools = append(confirmationTools, entry.PublishedName)
		}
		if entry.ExecutionMode == "suggest-only" {
			suggestOnlyTools = append(suggestOnlyTools, entry.PublishedName)
		}
	}

	lines := []string{
		"You are operating go-task-board-agent through the APP agent host.",
		"Use the registry-derived tool contracts exactly as published. Canonical execution always delegates through ctx.cases and the registered API surfaces.",
	}

	if len(confirmationTools) > 0 {
		lines = append(lines, fmt.Sprintf("Tools requiring confirmation: %s.", strings.Join(confirmationTools, ", ")))
	} else {
		lines = append(lines, "No tools currently require confirmation.")
	}

	if len(suggestOnlyTools) > 0 {
		lines = append(lines, fmt.Sprintf("Suggest-only tools: %s.", strings.Join(suggestOnlyTools, ", ")))
	}

	lines = append(lines, "Tool prompt fragments:")
	for _, entry := range catalog {
		lines = append(lines, buildToolPromptFragment(entry))
	}

	return strings.Join(lines, "\n\n"), nil
}

func (a *App) ServerInfo() (shared.AppMcpServerInfo, error) {
	instructions, err := a.BuildSystemPrompt(nil)
	if err != nil {
		return shared.AppMcpServerInfo{}, err
	}

	return shared.AppMcpServerInfo{
		Name:            AgentServerName,
		Version:         AppVersion,
		ProtocolVersion: MCPProtocolVersion,
		Instructions:    instructions,
	}, nil
}

func (a *App) InitializeMCP(params *shared.AppMcpInitializeParams, parent *shared.AppMcpRequestContext) (shared.AppMcpInitializeResult, error) {
	if params != nil && params.ProtocolVersion != "" && params.ProtocolVersion != MCPProtocolVersion && params.ProtocolVersion != MCPLegacyVersion {
		return shared.AppMcpInitializeResult{}, &shared.AppMcpProtocolError{
			Code:    -32602,
			Message: fmt.Sprintf("Unsupported MCP protocol version %s.", params.ProtocolVersion),
			Data: shared.Dict{
				"supported": []string{MCPProtocolVersion, MCPLegacyVersion},
			},
		}
	}

	info, err := a.ServerInfo()
	if err != nil {
		return shared.AppMcpInitializeResult{}, err
	}

	result := shared.AppMcpInitializeResult{
		ProtocolVersion: info.ProtocolVersion,
		Instructions:    info.Instructions,
	}
	result.Capabilities.Tools.ListChanged = false
	result.Capabilities.Resources.ListChanged = false
	result.ServerInfo.Name = info.Name
	result.ServerInfo.Version = info.Version

	_ = parent
	return result, nil
}

func (a *App) ListMCPTools(parent *shared.AppMcpRequestContext) ([]shared.AppMcpToolDescriptor, error) {
	entries, err := a.registry.ListMcpEnabledTools(a.CreateAgenticContext(&ParentExecutionContext{
		MCP: parent,
	}))
	if err != nil {
		return nil, err
	}

	descriptors := make([]shared.AppMcpToolDescriptor, 0, len(entries))
	for _, entry := range entries {
		descriptors = append(descriptors, toMcpToolDescriptor(entry))
	}
	return descriptors, nil
}

func (a *App) ListMCPResources(parent *shared.AppMcpRequestContext) ([]shared.AppMcpResourceDescriptor, error) {
	entries, err := a.registry.ListMcpEnabledTools(a.CreateAgenticContext(&ParentExecutionContext{
		MCP: parent,
	}))
	if err != nil {
		return nil, err
	}

	resources := []shared.AppMcpResourceDescriptor{toMcpSystemPromptDescriptor()}
	for _, entry := range entries {
		resources = append(resources, toMcpSemanticResourceDescriptor(entry))
	}
	return resources, nil
}

func (a *App) ReadMCPResource(uri string, parent *shared.AppMcpRequestContext) (shared.AppMcpReadResourceResult, error) {
	if uri == systemPromptResource {
		prompt, err := a.BuildSystemPrompt(&ParentExecutionContext{MCP: parent})
		if err != nil {
			return shared.AppMcpReadResourceResult{}, err
		}
		return shared.AppMcpReadResourceResult{
			Contents: []shared.AppMcpTextResourceContent{
				{
					URI:      uri,
					MimeType: "text/markdown",
					Text:     prompt,
				},
			},
		}, nil
	}

	entries, err := a.registry.ListMcpEnabledTools(a.CreateAgenticContext(&ParentExecutionContext{
		MCP: parent,
	}))
	if err != nil {
		return shared.AppMcpReadResourceResult{}, err
	}

	for _, entry := range entries {
		if buildToolSemanticResourceURI(entry) == uri {
			payload := map[string]any{
				"app":                  "go-example-agent",
				"ref":                  entry.Ref,
				"publishedName":        entry.PublishedName,
				"isMcpEnabled":         entry.IsMcpEnabled,
				"requiresConfirmation": entry.RequiresConfirmation,
				"executionMode":        entry.ExecutionMode,
				"semanticSummary":      buildToolSemanticSummary(entry),
				"promptFragment":       buildToolPromptFragment(entry),
				"definition":           projectDefinition(definitionOf(entry)),
			}
			encoded, err := json.MarshalIndent(payload, "", "  ")
			if err != nil {
				return shared.AppMcpReadResourceResult{}, err
			}
			return shared.AppMcpReadResourceResult{
				Contents: []shared.AppMcpTextResourceContent{
					{
						URI:      uri,
						MimeType: "application/json",
						Text:     string(encoded),
					},
				},
			}, nil
		}
	}

	return shared.AppMcpReadResourceResult{}, &shared.AppMcpProtocolError{
		Code:    -32004,
		Message: fmt.Sprintf("MCP resource %s is not published by apps/agent.", uri),
	}
}

func (a *App) CallMCPTool(name string, args any, parent *shared.AppMcpRequestContext) (shared.AppMcpCallResult, error) {
	envelope := toExecutionEnvelope(args)

	entry, err := a.ResolveTool(name, &ParentExecutionContext{
		Confirmed: envelope.Confirmed,
		MCP:       parent,
	})
	if err != nil {
		return shared.AppMcpCallResult{}, err
	}
	if entry == nil || !entry.IsMcpEnabled {
		return toMcpErrorResult(&shared.AppCaseError{
			Code:    "NOT_FOUND",
			Message: fmt.Sprintf("MCP tool %s is not published by apps/agent", name),
		}), nil
	}

	data, err := a.ExecuteTool(name, envelope.Input, &ParentExecutionContext{
		Confirmed: envelope.Confirmed,
		MCP:       parent,
	})
	if err != nil {
		var caseErr *shared.AppCaseError
		if errorAs(err, &caseErr) {
			return toMcpErrorResult(caseErr), nil
		}
		return shared.AppMcpCallResult{}, err
	}

	return toMcpSuccessResult(entry.PublishedName, data), nil
}

func (a *App) ValidateAgenticRuntime() (map[string]int, error) {
	catalog, err := a.BuildAgentCatalog(&ParentExecutionContext{
		CorrelationID: "agent-runtime-validation",
	})
	if err != nil {
		return nil, err
	}

	if len(catalog) == 0 {
		return nil, fmt.Errorf("apps/agent must register at least one agentic tool")
	}

	adapters := a.mcpAdapters()
	if adapters == nil || adapters["stdio"] == nil {
		return nil, fmt.Errorf("apps/agent must register a concrete stdio MCP adapter in _providers.mcpAdapters")
	}
	if adapters == nil || adapters["http"] == nil {
		return nil, fmt.Errorf("apps/agent must register a concrete remote HTTP MCP adapter in _providers.mcpAdapters")
	}

	seen := map[string]struct{}{}
	for _, entry := range catalog {
		if _, exists := seen[entry.PublishedName]; exists {
			return nil, fmt.Errorf("apps/agent published duplicate tool name %s", entry.PublishedName)
		}
		seen[entry.PublishedName] = struct{}{}

		if strings.TrimSpace(buildToolSemanticSummary(entry)) == "" {
			return nil, fmt.Errorf("apps/agent failed to project semantic summary for %s", entry.PublishedName)
		}
	}

	for _, ref := range a.registry.ListAgenticCases() {
		instanceAny, err := a.registry.InstantiateAgentic(ref, a.CreateAgenticContext(&ParentExecutionContext{
			CorrelationID: "agent-runtime-validation",
		}))
		if err != nil {
			return nil, err
		}

		instance, ok := instanceAny.(agenticSurface)
		if !ok {
			return nil, fmt.Errorf("agentic surface %s/%s does not implement Test", ref.Domain, ref.CaseName)
		}

		if err := instance.Test(); err != nil {
			return nil, err
		}
	}

	prompt, err := a.BuildSystemPrompt(nil)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(prompt) == "" {
		return nil, fmt.Errorf("apps/agent must project a non-empty global system prompt")
	}

	resources, err := a.ListMCPResources(&shared.AppMcpRequestContext{Transport: "validation"})
	if err != nil {
		return nil, err
	}
	mcpEnabledCount := 0
	requireConfirmationCount := 0
	for _, entry := range catalog {
		if entry.IsMcpEnabled {
			mcpEnabledCount++
		}
		if entry.RequiresConfirmation {
			requireConfirmationCount++
		}
	}

	if len(resources) < mcpEnabledCount+1 {
		return nil, fmt.Errorf("apps/agent must publish a system prompt resource and one semantic resource per MCP-enabled tool")
	}

	return map[string]int{
		"tools":               len(catalog),
		"mcpEnabled":          mcpEnabledCount,
		"requireConfirmation": requireConfirmationCount,
	}, nil
}

func (a *App) PublishMCP() error {
	if _, err := a.ValidateAgenticRuntime(); err != nil {
		return err
	}

	adapter, ok := a.mcpAdapters()["stdio"].(shared.BaseAppMcpProcessAdapter)
	if !ok || adapter == nil {
		return fmt.Errorf("stdio MCP adapter is not configured")
	}

	return adapter.Serve(&mcpServer{app: a})
}

func (a *App) HandleRequest(res http.ResponseWriter, req *http.Request) {
	res.Header().Set("access-control-allow-origin", "*")
	res.Header().Set("access-control-allow-methods", "GET,POST,OPTIONS")
	res.Header().Set("access-control-allow-headers", "content-type")
	res.Header().Set("cache-control", "no-store")

	if req.Method == http.MethodOptions {
		res.WriteHeader(http.StatusNoContent)
		return
	}

	if handled, err := a.handleRemoteMCP(res, req); handled {
		if err != nil {
			a.writeStructuredError(res, 500, "INTERNAL", err.Error(), nil)
		}
		return
	}

	if req.Method == http.MethodGet && req.URL.Path == "/health" {
		a.writeJSON(res, http.StatusOK, map[string]any{
			"ok":     true,
			"app":    "go-example-agent",
			"status": "ready",
		})
		return
	}

	if req.Method == http.MethodGet && req.URL.Path == "/manifest" {
		catalog, err := a.BuildAgentCatalog(nil)
		if err != nil {
			a.writeStructuredError(res, 500, "INTERNAL", err.Error(), nil)
			return
		}

		prompt, err := a.BuildSystemPrompt(nil)
		if err != nil {
			a.writeStructuredError(res, 500, "INTERNAL", err.Error(), nil)
			return
		}

		a.writeJSON(res, http.StatusOK, map[string]any{
			"app":               "go-example-agent",
			"port":              a.registry._providers["port"],
			"registeredDomains": mapKeys(a.registry._cases),
			"packages":          mapKeys(a.registry._packages),
			"tools":             publishedNames(catalog, false),
			"mcpEnabledTools":   publishedNames(catalog, true),
			"transports": map[string]any{
				"http": true,
				"mcp": map[string]any{
					"stdio":      adapterTransport(a.mcpAdapters()["stdio"]),
					"remote":     adapterTransport(a.mcpAdapters()["http"]),
					"remotePath": adapterEndpoint(a.mcpAdapters()["http"]),
				},
			},
			"systemPrompt": prompt,
		})
		return
	}

	if req.Method == http.MethodGet && req.URL.Path == "/catalog" {
		catalog, err := a.BuildAgentCatalog(nil)
		if err != nil {
			a.writeStructuredError(res, 500, "INTERNAL", err.Error(), nil)
			return
		}
		prompt, err := a.BuildSystemPrompt(nil)
		if err != nil {
			a.writeStructuredError(res, 500, "INTERNAL", err.Error(), nil)
			return
		}
		resources, err := a.ListMCPResources(&shared.AppMcpRequestContext{Transport: "http"})
		if err != nil {
			a.writeStructuredError(res, 500, "INTERNAL", err.Error(), nil)
			return
		}

		tools := make([]map[string]any, 0, len(catalog))
		for _, entry := range catalog {
			tools = append(tools, toCatalogDocument(entry))
		}

		a.writeJSON(res, http.StatusOK, map[string]any{
			"success": true,
			"data": map[string]any{
				"systemPrompt": prompt,
				"resources":    resources,
				"tools":        tools,
			},
		})
		return
	}

	if req.Method == http.MethodPost && strings.HasPrefix(req.URL.Path, "/tools/") && strings.HasSuffix(req.URL.Path, "/execute") {
		toolName := strings.TrimSuffix(strings.TrimPrefix(req.URL.Path, "/tools/"), "/execute")
		body, err := readRequestBody(req)
		if err != nil {
			a.writeStructuredError(res, 400, "INVALID_REQUEST", err.Error(), nil)
			return
		}

		envelope := toExecutionEnvelope(body)
		entry, err := a.ResolveTool(toolName, &ParentExecutionContext{
			Confirmed: envelope.Confirmed,
		})
		if err != nil {
			var caseErr *shared.AppCaseError
			if errorAs(err, &caseErr) {
				a.writeStructuredError(res, mapAgentErrorCodeToStatus(caseErr.Code), caseErr.Code, caseErr.Message, caseErr.Details)
				return
			}
			a.writeStructuredError(res, 500, "INTERNAL", err.Error(), nil)
			return
		}
		if entry == nil {
			a.writeStructuredError(res, http.StatusNotFound, "NOT_FOUND", fmt.Sprintf("Tool %s is not registered in apps/agent", toolName), nil)
			return
		}

		data, err := a.ExecuteTool(toolName, envelope.Input, &ParentExecutionContext{
			Confirmed: envelope.Confirmed,
		})
		if err != nil {
			var caseErr *shared.AppCaseError
			if errorAs(err, &caseErr) {
				a.writeStructuredError(res, mapAgentErrorCodeToStatus(caseErr.Code), caseErr.Code, caseErr.Message, caseErr.Details)
				return
			}
			a.writeStructuredError(res, 500, "INTERNAL", err.Error(), nil)
			return
		}

		a.writeJSON(res, http.StatusOK, map[string]any{
			"success": true,
			"data":    data,
			"meta": map[string]any{
				"toolName":             entry.PublishedName,
				"requiresConfirmation": entry.RequiresConfirmation,
				"executionMode":        entry.ExecutionMode,
			},
		})
		return
	}

	a.writeStructuredError(res, 404, "NOT_FOUND", "Route not found in agent scaffold.", map[string]any{
		"method": req.Method,
		"path":   req.URL.Path,
	})
}

func (a *App) StartAgent() (*http.Server, net.Listener, error) {
	if _, err := a.ValidateAgenticRuntime(); err != nil {
		return nil, nil, err
	}

	port, _ := a.registry._providers["port"].(int)
	listener, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return nil, nil, err
	}

	server := &http.Server{
		Handler: http.HandlerFunc(a.HandleRequest),
	}

	go func() {
		_ = server.Serve(listener)
	}()

	summary, _ := a.ValidateAgenticRuntime()
	a.logger.Info("Agent scaffold started", map[string]any{
		"port":                listener.Addr().(*net.TCPAddr).Port,
		"tools":               summary["tools"],
		"mcpEnabled":          summary["mcpEnabled"],
		"requireConfirmation": summary["requireConfirmation"],
	})

	return server, listener, nil
}

func (a *App) handleRemoteMCP(res http.ResponseWriter, req *http.Request) (bool, error) {
	httpAdapter, ok := a.mcpAdapters()["http"].(shared.BaseAppMcpHTTPAdapter)
	if !ok || httpAdapter == nil {
		return false, nil
	}

	if req.URL.Path != httpAdapter.EndpointPath() {
		return false, nil
	}

	bodyText := ""
	if req.Method == http.MethodPost {
		body, err := readRawRequestBody(req)
		if err != nil {
			return true, err
		}
		bodyText = body
	}

	response, err := httpAdapter.Handle(shared.AppMcpHTTPExchange{
		Method:   req.Method,
		Path:     req.URL.Path,
		Headers:  requestHeaders(req),
		BodyText: bodyText,
	}, &mcpServer{app: a})
	if err != nil {
		return true, err
	}

	if response == nil {
		response = &shared.AppMcpHTTPResponse{
			StatusCode: http.StatusNotFound,
			Headers: map[string]string{
				"cache-control": "no-store",
			},
		}
	}

	for name, value := range response.Headers {
		res.Header().Set(name, value)
	}
	res.WriteHeader(response.StatusCode)
	if response.BodyText != "" {
		_, _ = res.Write([]byte(response.BodyText))
	}

	return true, nil
}

func (a *App) mcpAdapters() shared.Dict {
	adapters, _ := a.registry._providers["mcpAdapters"].(shared.Dict)
	return adapters
}

func (a *App) writeJSON(res http.ResponseWriter, statusCode int, body any) {
	res.Header().Set("content-type", "application/json; charset=utf-8")
	res.WriteHeader(statusCode)
	_ = json.NewEncoder(res).Encode(body)
}

func (a *App) writeStructuredError(res http.ResponseWriter, statusCode int, code string, message string, details any) {
	payload := map[string]any{
		"success": false,
		"error": map[string]any{
			"code":    code,
			"message": message,
		},
	}
	if details != nil {
		payload["error"].(map[string]any)["details"] = details
	}
	a.writeJSON(res, statusCode, payload)
}

func (s *mcpServer) ServerInfo() shared.AppMcpServerInfo {
	info, err := s.app.ServerInfo()
	if err != nil {
		return shared.AppMcpServerInfo{}
	}
	return info
}

func (s *mcpServer) Initialize(params *shared.AppMcpInitializeParams, parent *shared.AppMcpRequestContext) (shared.AppMcpInitializeResult, error) {
	return s.app.InitializeMCP(params, parent)
}

func (s *mcpServer) ListTools(parent *shared.AppMcpRequestContext) ([]shared.AppMcpToolDescriptor, error) {
	return s.app.ListMCPTools(parent)
}

func (s *mcpServer) ListResources(parent *shared.AppMcpRequestContext) ([]shared.AppMcpResourceDescriptor, error) {
	return s.app.ListMCPResources(parent)
}

func (s *mcpServer) ReadResource(uri string, parent *shared.AppMcpRequestContext) (shared.AppMcpReadResourceResult, error) {
	return s.app.ReadMCPResource(uri, parent)
}

func (s *mcpServer) CallTool(name string, args any, parent *shared.AppMcpRequestContext) (shared.AppMcpCallResult, error) {
	return s.app.CallMCPTool(name, args, parent)
}

func definitionOf(entry shared.AgenticCatalogEntry) core.AgenticDefinition {
	return entry.Definition.(core.AgenticDefinition)
}

func buildToolSemanticResourceURI(entry shared.AgenticCatalogEntry) string {
	return fmt.Sprintf("app://agent/tools/%s/semantic", entry.PublishedName)
}

func buildToolSemanticSummary(entry shared.AgenticCatalogEntry) string {
	definition := definitionOf(entry)
	parts := []string{strings.TrimSpace(definition.Prompt.Purpose)}
	if text := joinSentence("Use when", append(definition.Prompt.WhenToUse, definition.Discovery.Intents...)); text != "" {
		parts = append(parts, text)
	}
	if text := joinSentence("Do not use when", definition.Prompt.WhenNotToUse); text != "" {
		parts = append(parts, text)
	}
	if text := joinSentence("Preconditions", definition.Context.Preconditions); text != "" {
		parts = append(parts, text)
	}
	constraints := append([]string{}, definition.Context.Constraints...)
	constraints = append(constraints, definition.Prompt.Constraints...)
	if definition.Policy != nil {
		constraints = append(constraints, definition.Policy.Limits...)
	}
	if text := joinSentence("Constraints", constraints); text != "" {
		parts = append(parts, text)
	}
	if definition.Prompt.ExpectedOutcome != "" {
		parts = append(parts, fmt.Sprintf("Expected outcome: %s.", strings.TrimSpace(definition.Prompt.ExpectedOutcome)))
	}
	return strings.Join(parts, " ")
}

func buildToolPromptFragment(entry shared.AgenticCatalogEntry) string {
	definition := definitionOf(entry)
	lines := []string{
		fmt.Sprintf("Tool %s: %s", entry.PublishedName, definition.Prompt.Purpose),
	}
	if text := joinSentence("Use when", append(definition.Prompt.WhenToUse, definition.Discovery.Intents...)); text != "" {
		lines = append(lines, text)
	}
	if text := joinSentence("Do not use when", definition.Prompt.WhenNotToUse); text != "" {
		lines = append(lines, text)
	}
	if text := joinSentence("Aliases", definition.Discovery.Aliases); text != "" {
		lines = append(lines, text)
	}
	if text := joinSentence("Capabilities", definition.Discovery.Capabilities); text != "" {
		lines = append(lines, text)
	}
	if text := joinSentence("Dependencies", definition.Context.Dependencies); text != "" {
		lines = append(lines, text)
	}
	if text := joinSentence("Preconditions", definition.Context.Preconditions); text != "" {
		lines = append(lines, text)
	}
	constraints := append([]string{}, definition.Context.Constraints...)
	constraints = append(constraints, definition.Prompt.Constraints...)
	if definition.Policy != nil {
		constraints = append(constraints, definition.Policy.Limits...)
	}
	if text := joinSentence("Constraints", constraints); text != "" {
		lines = append(lines, text)
	}
	if text := joinSentence("Reasoning hints", definition.Prompt.ReasoningHints); text != "" {
		lines = append(lines, text)
	}
	if definition.RAG != nil {
		if text := joinSentence("RAG topics", definition.RAG.Topics); text != "" {
			lines = append(lines, text)
		}
		resourceTexts := []string{}
		for _, resource := range definition.RAG.Resources {
			if resource.Description != "" {
				resourceTexts = append(resourceTexts, fmt.Sprintf("%s:%s (%s)", resource.Kind, resource.Ref, resource.Description))
			} else {
				resourceTexts = append(resourceTexts, fmt.Sprintf("%s:%s", resource.Kind, resource.Ref))
			}
		}
		if text := joinSentence("RAG resources", resourceTexts); text != "" {
			lines = append(lines, text)
		}
		if text := joinSentence("RAG hints", definition.RAG.Hints); text != "" {
			lines = append(lines, text)
		}
	}
	lines = append(lines, fmt.Sprintf("Execution mode: %s.", entry.ExecutionMode))
	lines = append(lines, fmt.Sprintf("Requires confirmation: %s.", yesNo(entry.RequiresConfirmation)))
	if definition.Prompt.ExpectedOutcome != "" {
		lines = append(lines, fmt.Sprintf("Expected outcome: %s.", definition.Prompt.ExpectedOutcome))
	}
	return strings.Join(lines, "\n")
}

func toCatalogDocument(entry shared.AgenticCatalogEntry) map[string]any {
	return map[string]any{
		"ref":                  entry.Ref,
		"publishedName":        entry.PublishedName,
		"isMcpEnabled":         entry.IsMcpEnabled,
		"requiresConfirmation": entry.RequiresConfirmation,
		"executionMode":        entry.ExecutionMode,
		"semanticSummary":      buildToolSemanticSummary(entry),
		"promptFragment":       buildToolPromptFragment(entry),
		"resources": map[string]any{
			"semantic": buildToolSemanticResourceURI(entry),
		},
		"definition": projectDefinition(definitionOf(entry)),
	}
}

func toMcpToolDescriptor(entry shared.AgenticCatalogEntry) shared.AppMcpToolDescriptor {
	definition := definitionOf(entry)
	summary := buildToolSemanticSummary(entry)
	title := humanizeIdentifier(entry.PublishedName)
	description := summary
	if definition.MCP != nil {
		if definition.MCP.Title != "" {
			title = definition.MCP.Title
		}
		if definition.MCP.Description != "" {
			description = strings.TrimSpace(definition.MCP.Description + " " + summary)
		}
	}

	return shared.AppMcpToolDescriptor{
		Name:         entry.PublishedName,
		Title:        title,
		Description:  description,
		InputSchema:  definition.Tool.InputSchema,
		OutputSchema: definition.Tool.OutputSchema,
		Annotations:  toMcpSemanticAnnotations(entry),
	}
}

func toMcpSemanticAnnotations(entry shared.AgenticCatalogEntry) shared.Dict {
	definition := definitionOf(entry)
	exampleNames := []string{}
	for _, example := range definition.Examples {
		exampleNames = append(exampleNames, example.Name)
	}
	return shared.Dict{
		"readOnlyHint":         !definition.Tool.IsMutating,
		"destructiveHint":      definition.Tool.IsMutating,
		"requiresConfirmation": entry.RequiresConfirmation,
		"executionMode":        entry.ExecutionMode,
		"appSemantic": shared.Dict{
			"summary":      buildToolSemanticSummary(entry),
			"discovery":    definition.Discovery,
			"context":      definition.Context,
			"prompt":       definition.Prompt,
			"policy":       definition.Policy,
			"rag":          definition.RAG,
			"exampleNames": exampleNames,
			"resourceUri":  buildToolSemanticResourceURI(entry),
		},
	}
}

func toMcpSemanticResourceDescriptor(entry shared.AgenticCatalogEntry) shared.AppMcpResourceDescriptor {
	return shared.AppMcpResourceDescriptor{
		URI:         buildToolSemanticResourceURI(entry),
		Name:        fmt.Sprintf("%s_semantic", entry.PublishedName),
		Title:       fmt.Sprintf("%s Semantic Contract", humanizeIdentifier(entry.PublishedName)),
		Description: fmt.Sprintf("Complete APP agentic definition projected automatically from the registry for %s.", entry.PublishedName),
		MimeType:    "application/json",
		Annotations: shared.Dict{
			"toolName":             entry.PublishedName,
			"executionMode":        entry.ExecutionMode,
			"requiresConfirmation": entry.RequiresConfirmation,
		},
	}
}

func toMcpSystemPromptDescriptor() shared.AppMcpResourceDescriptor {
	return shared.AppMcpResourceDescriptor{
		URI:         systemPromptResource,
		Name:        "agent_system_prompt",
		Title:       "Agent System Prompt",
		Description: "Host-level system prompt composed automatically from the registered tool fragments.",
		MimeType:    "text/markdown",
		Annotations: shared.Dict{"kind": "system-prompt"},
	}
}

func toMcpSuccessResult(toolName string, data any) shared.AppMcpCallResult {
	return shared.AppMcpCallResult{
		Content: []shared.AppMcpTextContent{
			{
				Type: "text",
				Text: fmt.Sprintf("Tool %s executed successfully.", toolName),
			},
		},
		StructuredContent: data,
		IsError:           false,
	}
}

func toMcpErrorResult(err *shared.AppCaseError) shared.AppMcpCallResult {
	return shared.AppMcpCallResult{
		Content: []shared.AppMcpTextContent{
			{
				Type: "text",
				Text: err.Message,
			},
		},
		StructuredContent: map[string]any{
			"success": false,
			"error":   err.ToAppError(),
		},
		IsError: true,
	}
}

func projectDefinition(definition core.AgenticDefinition) map[string]any {
	encoded, _ := json.Marshal(definition)
	decoded := map[string]any{}
	_ = json.Unmarshal(encoded, &decoded)
	return decoded
}

func toExecutionEnvelope(body any) ExecuteEnvelope {
	record, ok := body.(map[string]any)
	if !ok || record == nil {
		return ExecuteEnvelope{Input: body}
	}

	envelope := ExecuteEnvelope{}
	if confirmed, ok := record["confirmed"].(bool); ok {
		envelope.Confirmed = confirmed
	}
	if input, exists := record["input"]; exists {
		envelope.Input = input
		return envelope
	}
	envelope.Input = body
	return envelope
}

func joinSentence(label string, values []string) string {
	normalized := normalizeTextItems(values)
	if len(normalized) == 0 {
		return ""
	}
	return fmt.Sprintf("%s: %s.", label, strings.Join(normalized, "; "))
}

func normalizeTextItems(values []string) []string {
	seen := map[string]struct{}{}
	normalized := []string{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

func humanizeIdentifier(value string) string {
	parts := strings.FieldsFunc(value, func(r rune) bool {
		return r == '_' || r == '-'
	})
	for index, part := range parts {
		if part == "" {
			continue
		}
		parts[index] = strings.ToUpper(part[:1]) + part[1:]
	}
	return strings.Join(parts, " ")
}

func yesNo(value bool) string {
	if value {
		return "yes"
	}
	return "no"
}

func adapterTransport(value any) string {
	switch adapter := value.(type) {
	case shared.BaseAppMcpProcessAdapter:
		return adapter.Transport()
	case shared.BaseAppMcpHTTPAdapter:
		return adapter.Transport()
	default:
		return ""
	}
}

func adapterEndpoint(value any) string {
	if adapter, ok := value.(shared.BaseAppMcpHTTPAdapter); ok {
		return adapter.EndpointPath()
	}
	return ""
}

func requestHeaders(req *http.Request) map[string]string {
	headers := map[string]string{}
	for name, values := range req.Header {
		headers[strings.ToLower(name)] = strings.Join(values, ", ")
	}
	return headers
}

func mapAgentErrorCodeToStatus(code string) int {
	switch code {
	case "INVALID_REQUEST", "VALIDATION_FAILED":
		return 400
	case "NOT_FOUND":
		return 404
	case "CONFIRMATION_REQUIRED", "EXECUTION_MODE_RESTRICTED":
		return 409
	default:
		return 500
	}
}

func publishedNames(entries []shared.AgenticCatalogEntry, mcpOnly bool) []string {
	values := []string{}
	for _, entry := range entries {
		if mcpOnly && !entry.IsMcpEnabled {
			continue
		}
		values = append(values, entry.PublishedName)
	}
	return values
}

func parentCorrelation(parent *ParentExecutionContext) string {
	if parent == nil {
		return ""
	}
	return parent.CorrelationID
}

func parentTenant(parent *ParentExecutionContext) string {
	if parent == nil {
		return ""
	}
	return parent.TenantID
}

func parentUser(parent *ParentExecutionContext) string {
	if parent == nil {
		return ""
	}
	return parent.UserID
}

func parentConfig(parent *ParentExecutionContext) shared.Dict {
	if parent == nil {
		return nil
	}
	return parent.Config
}

func parentTransport(parent *ParentExecutionContext) string {
	if parent == nil || parent.MCP == nil || parent.MCP.Transport == "" {
		return "http"
	}
	return parent.MCP.Transport
}

func parentSessionID(parent *ParentExecutionContext) string {
	if parent == nil || parent.MCP == nil {
		return ""
	}
	return parent.MCP.SessionID
}

func parentClientInfo(parent *ParentExecutionContext) *shared.AppMcpClientInfo {
	if parent == nil || parent.MCP == nil {
		return nil
	}
	return parent.MCP.ClientInfo
}

func parentMCP(parent *ParentExecutionContext) *shared.AppMcpRequestContext {
	if parent == nil {
		return nil
	}
	return parent.MCP
}

func chooseString(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func chooseDict(value shared.Dict) shared.Dict {
	if value == nil {
		return shared.Dict{}
	}
	return value
}
