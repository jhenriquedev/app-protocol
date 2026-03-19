package backend

import (
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
				},
				"task_list": {
					API: func(ctx any) any {
						return task_list.NewAPI(ctx.(*core.ApiContext))
					},
				},
				"task_move": {
					API: func(ctx any) any {
						return task_move.NewAPI(ctx.(*core.ApiContext))
					},
				},
			},
		},
		_providers: shared.Dict{
			"port":      config.Port,
			"taskStore": taskStore,
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
