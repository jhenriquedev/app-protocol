package agent

import (
	"fmt"
	"path/filepath"

	"app-protocol/examples/go/cases/tasks/task_create"
	"app-protocol/examples/go/cases/tasks/task_list"
	"app-protocol/examples/go/cases/tasks/task_move"
	"app-protocol/examples/go/core"
	"app-protocol/examples/go/core/shared"
	"app-protocol/examples/go/packages/data"
)

type Config struct {
	Port          int
	DataDirectory string
}

type Registry struct {
	_cases     map[string]map[string]shared.AppCaseSurfaces
	_providers shared.Dict
	_packages  shared.Dict
}

type agenticSurface interface {
	Definition() core.AgenticDefinition
	Test() error
}

func CreateRegistry(config Config) *Registry {
	dataDirectory := config.DataDirectory
	if dataDirectory == "" {
		dataDirectory = filepath.Join("packages", "data")
	}

	dataPackage := data.New(dataDirectory)
	taskStore := data.NewJSONFileStore[[]map[string]any](dataPackage.DefaultFiles.Tasks, []map[string]any{})

	return &Registry{
		_cases: map[string]map[string]shared.AppCaseSurfaces{
			"tasks": {
				"task_create": {
					API: func(ctx any) any {
						return task_create.NewAPI(ctx.(*core.ApiContext))
					},
					Agentic: func(ctx any) any {
						return task_create.NewAgentic(ctx.(*core.AgenticContext))
					},
				},
				"task_list": {
					API: func(ctx any) any {
						return task_list.NewAPI(ctx.(*core.ApiContext))
					},
					Agentic: func(ctx any) any {
						return task_list.NewAgentic(ctx.(*core.AgenticContext))
					},
				},
				"task_move": {
					API: func(ctx any) any {
						return task_move.NewAPI(ctx.(*core.ApiContext))
					},
					Agentic: func(ctx any) any {
						return task_move.NewAgentic(ctx.(*core.AgenticContext))
					},
				},
			},
		},
		_providers: shared.Dict{
			"port":      config.Port,
			"taskStore": taskStore,
			"mcpAdapters": shared.Dict{
				"stdio": NewStdioAdapter(),
				"http":  NewStreamableHTTPAdapter(),
			},
		},
		_packages: shared.Dict{
			"data": dataPackage,
		},
	}
}

func (r *Registry) Cases() map[string]map[string]shared.AppCaseSurfaces {
	return r._cases
}

func (r *Registry) Providers() shared.Dict {
	return r._providers
}

func (r *Registry) Packages() shared.Dict {
	return r._packages
}

func (r *Registry) ListAgenticCases() []shared.AgenticCaseRef {
	refs := []shared.AgenticCaseRef{}
	for domainName, domainCases := range r._cases {
		for caseName, surfaces := range domainCases {
			if surfaces.Agentic != nil {
				refs = append(refs, shared.AgenticCaseRef{
					Domain:   domainName,
					CaseName: caseName,
				})
			}
		}
	}

	return refs
}

func (r *Registry) GetAgenticSurface(ref shared.AgenticCaseRef) shared.ContextualFactory {
	domainCases, ok := r._cases[ref.Domain]
	if !ok {
		return nil
	}

	surfaces, ok := domainCases[ref.CaseName]
	if !ok {
		return nil
	}

	return surfaces.Agentic
}

func (r *Registry) InstantiateAgentic(ref shared.AgenticCaseRef, ctx any) (any, error) {
	factory := r.GetAgenticSurface(ref)
	if factory == nil {
		return nil, fmt.Errorf("agentic surface not found for %s/%s", ref.Domain, ref.CaseName)
	}

	return factory(ctx), nil
}

func (r *Registry) BuildCatalog(ctx any) ([]shared.AgenticCatalogEntry, error) {
	entries := []shared.AgenticCatalogEntry{}
	for _, ref := range r.ListAgenticCases() {
		instanceAny, err := r.InstantiateAgentic(ref, ctx)
		if err != nil {
			return nil, err
		}

		instance, ok := instanceAny.(agenticSurface)
		if !ok {
			return nil, fmt.Errorf("agentic surface for %s/%s does not implement Definition", ref.Domain, ref.CaseName)
		}

		definition := instance.Definition()
		requiresConfirmation := definition.Tool.RequiresConfirmation
		if definition.Policy != nil && definition.Policy.RequireConfirmation {
			requiresConfirmation = true
		}

		executionMode := "direct-execution"
		if definition.Policy != nil && definition.Policy.ExecutionMode != "" {
			executionMode = definition.Policy.ExecutionMode
		} else if requiresConfirmation {
			executionMode = "manual-approval"
		}

		publishedName := definition.Tool.Name
		isMcpEnabled := false
		if definition.MCP != nil && definition.MCP.Enabled {
			isMcpEnabled = true
			if definition.MCP.Name != "" {
				publishedName = definition.MCP.Name
			}
		}

		entries = append(entries, shared.AgenticCatalogEntry{
			Ref:                  ref,
			PublishedName:        publishedName,
			Definition:           definition,
			IsMcpEnabled:         isMcpEnabled,
			RequiresConfirmation: requiresConfirmation,
			ExecutionMode:        executionMode,
		})
	}

	return entries, nil
}

func (r *Registry) ResolveTool(toolName string, ctx any) (*shared.AgenticCatalogEntry, error) {
	catalog, err := r.BuildCatalog(ctx)
	if err != nil {
		return nil, err
	}

	for index := range catalog {
		entry := &catalog[index]
		definition := entry.Definition.(core.AgenticDefinition)
		if entry.PublishedName == toolName || definition.Tool.Name == toolName {
			return entry, nil
		}
	}

	return nil, nil
}

func (r *Registry) ListMcpEnabledTools(ctx any) ([]shared.AgenticCatalogEntry, error) {
	catalog, err := r.BuildCatalog(ctx)
	if err != nil {
		return nil, err
	}

	tools := []shared.AgenticCatalogEntry{}
	for _, entry := range catalog {
		if entry.IsMcpEnabled {
			tools = append(tools, entry)
		}
	}

	return tools, nil
}
