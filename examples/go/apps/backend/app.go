package backend

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"

	"app-protocol/examples/go/core"
	"app-protocol/examples/go/core/shared"
)

type App struct {
	registry *Registry
	logger   shared.AppLogger
}

type routeCapable interface {
	core.APIHandler
	Router() core.RouteBinding
}

func Bootstrap(config Config) *App {
	return &App{
		registry: CreateRegistry(config),
		logger:   shared.DefaultLogger{Prefix: "[backend]"},
	}
}

func (a *App) Registry() *Registry {
	return a.registry
}

func (a *App) CreateAPIContext(parent *core.ApiContext) *core.ApiContext {
	context := &core.ApiContext{
		AppBaseContext: shared.AppBaseContext{
			CorrelationID: chooseString(parentValue(parent, "correlationId"), shared.NewID()),
			ExecutionID:   shared.NewID(),
			TenantID:      chooseString(parentValue(parent, "tenantId"), ""),
			UserID:        chooseString(parentValue(parent, "userId"), ""),
			Logger:        a.logger,
			Config:        chooseDict(parentConfig(parent)),
		},
		Packages: a.registry._packages,
		Extra: shared.Dict{
			"providers": a.registry._providers,
		},
	}

	context.Cases = a.materializeCases(context)
	return context
}

func (a *App) materializeCases(ctx *core.ApiContext) shared.Dict {
	cases := shared.Dict{}
	for domainName, domainCases := range a.registry._cases {
		domainEntry := shared.Dict{}
		for caseName, surfaces := range domainCases {
			surfaceEntry := shared.Dict{}
			if surfaces.API != nil {
				instance := surfaces.API(ctx).(core.APIHandler)
				surfaceEntry["api"] = instance
			}
			domainEntry[caseName] = surfaceEntry
		}
		cases[domainName] = domainEntry
	}

	return cases
}

func (a *App) routes() ([]core.RouteBinding, error) {
	bootContext := a.CreateAPIContext(&core.ApiContext{
		AppBaseContext: shared.AppBaseContext{
			CorrelationID: "boot",
		},
	})

	routes := []core.RouteBinding{}
	for _, domainCases := range a.registry._cases {
		for _, surfaces := range domainCases {
			if surfaces.API == nil {
				continue
			}

			apiFactory := surfaces.API
			instance, ok := apiFactory(bootContext).(routeCapable)
			if !ok {
				return nil, fmt.Errorf("mounted API surface does not implement Router")
			}

			declarativeRoute := instance.Router()
			routes = append(routes, core.RouteBinding{
				Method: declarativeRoute.Method,
				Path:   declarativeRoute.Path,
				Handler: func(request core.RouteRequest) (any, error) {
					runtimeContext := a.CreateAPIContext(nil)
					runtimeInstance, ok := apiFactory(runtimeContext).(routeCapable)
					if !ok {
						return nil, fmt.Errorf("mounted API surface does not implement Router")
					}
					return runtimeInstance.Router().Handler(request)
				},
			})
		}
	}

	return routes, nil
}

func (a *App) HandleRequest(res http.ResponseWriter, req *http.Request) {
	res.Header().Set("access-control-allow-origin", "*")
	res.Header().Set("access-control-allow-methods", "GET,POST,PATCH,OPTIONS")
	res.Header().Set("access-control-allow-headers", "content-type")
	res.Header().Set("cache-control", "no-store")

	if req.Method == http.MethodOptions {
		res.WriteHeader(http.StatusNoContent)
		return
	}

	if req.Method == http.MethodGet && req.URL.Path == "/health" {
		a.writeJSON(res, http.StatusOK, map[string]any{
			"ok":     true,
			"app":    "go-example-backend",
			"status": "ready",
		})
		return
	}

	if req.Method == http.MethodGet && req.URL.Path == "/manifest" {
		routes, _ := a.routes()
		routeNames := make([]string, 0, len(routes))
		for _, route := range routes {
			routeNames = append(routeNames, fmt.Sprintf("%s %s", route.Method, route.Path))
		}

		a.writeJSON(res, http.StatusOK, map[string]any{
			"app":               "go-example-backend",
			"port":              a.registry._providers["port"],
			"registeredDomains": mapKeys(a.registry._cases),
			"packages":          mapKeys(a.registry._packages),
			"routes":            routeNames,
		})
		return
	}

	routes, err := a.routes()
	if err != nil {
		a.writeStructuredError(res, 500, "INTERNAL", err.Error(), nil)
		return
	}

	match, params := resolveRoute(routes, req.Method, req.URL.Path)
	if match == nil {
		a.writeStructuredError(res, 404, "NOT_FOUND", "Route not found in structural scaffold.", map[string]any{
			"method": req.Method,
			"path":   req.URL.Path,
		})
		return
	}

	body, err := readRequestBody(req)
	if err != nil {
		a.writeStructuredError(res, 400, "INVALID_REQUEST", err.Error(), nil)
		return
	}

	response, handlerErr := match.Handler(core.RouteRequest{
		Body:       body,
		Method:     strings.ToUpper(req.Method),
		Path:       req.URL.Path,
		Params:     params,
		RawRequest: req,
	})
	if handlerErr != nil {
		var caseErr *shared.AppCaseError
		if ok := errorAs(handlerErr, &caseErr); ok {
			a.writeStructuredError(res, mapErrorCodeToStatus(caseErr.Code), caseErr.Code, caseErr.Message, caseErr.Details)
			return
		}

		a.writeStructuredError(res, 500, "INTERNAL", "Internal backend scaffold error.", nil)
		return
	}

	statusCode := 200
	if withStatus, ok := response.(interface{ HTTPStatus() int }); ok && withStatus.HTTPStatus() > 0 {
		statusCode = withStatus.HTTPStatus()
	}

	a.writeJSON(res, statusCode, response)
}

func (a *App) StartBackend() (*http.Server, net.Listener, error) {
	port, _ := a.registry._providers["port"].(int)
	if port < 0 {
		port = 0
	}

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

	a.logger.Info("Backend scaffold started", map[string]any{
		"port":     listener.Addr().(*net.TCPAddr).Port,
		"packages": mapKeys(a.registry._packages),
	})

	return server, listener, nil
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
