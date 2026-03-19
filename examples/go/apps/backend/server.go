package backend

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"app-protocol/examples/go/core"
	"app-protocol/examples/go/core/shared"
)

func readRequestBody(req *http.Request) (any, error) {
	if req.Body == nil {
		return nil, nil
	}

	content, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}

	trimmed := strings.TrimSpace(string(content))
	if trimmed == "" {
		return nil, nil
	}

	var decoded any
	if err := json.Unmarshal([]byte(trimmed), &decoded); err != nil {
		return nil, err
	}

	return decoded, nil
}

func resolveRoute(routes []core.RouteBinding, method string, path string) (*core.RouteBinding, map[string]string) {
	for index := range routes {
		route := &routes[index]
		if strings.ToUpper(route.Method) != strings.ToUpper(method) {
			continue
		}

		params, ok := matchRoutePath(route.Path, path)
		if ok {
			return route, params
		}
	}

	return nil, nil
}

func matchRoutePath(routePath string, actualPath string) (map[string]string, bool) {
	routeSegments := splitPath(routePath)
	pathSegments := splitPath(actualPath)
	if len(routeSegments) != len(pathSegments) {
		return nil, false
	}

	params := map[string]string{}
	for index := range routeSegments {
		routeSegment := routeSegments[index]
		pathSegment := pathSegments[index]

		if strings.HasPrefix(routeSegment, ":") {
			params[strings.TrimPrefix(routeSegment, ":")] = pathSegment
			continue
		}

		if routeSegment != pathSegment {
			return nil, false
		}
	}

	return params, true
}

func splitPath(value string) []string {
	rawSegments := strings.Split(strings.TrimSpace(value), "/")
	segments := []string{}
	for _, segment := range rawSegments {
		if segment != "" {
			segments = append(segments, segment)
		}
	}
	return segments
}

func mapKeys[T any](values map[string]T) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	return keys
}

func mapErrorCodeToStatus(code string) int {
	switch code {
	case "INVALID_REQUEST", "VALIDATION_FAILED":
		return 400
	case "UNAUTHORIZED":
		return 401
	case "FORBIDDEN":
		return 403
	case "NOT_FOUND":
		return 404
	case "CONFLICT":
		return 409
	default:
		return 500
	}
}

func errorAs(err error, target **shared.AppCaseError) bool {
	return errors.As(err, target)
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

func parentValue(parent *core.ApiContext, field string) string {
	if parent == nil {
		return ""
	}

	switch field {
	case "correlationId":
		return parent.CorrelationID
	case "tenantId":
		return parent.TenantID
	case "userId":
		return parent.UserID
	default:
		return ""
	}
}

func parentConfig(parent *core.ApiContext) shared.Dict {
	if parent == nil {
		return nil
	}
	return parent.Config
}
