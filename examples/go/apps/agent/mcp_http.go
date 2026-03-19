package agent

import (
	"encoding/json"
	"fmt"
	"strings"

	"app-protocol/examples/go/core/shared"
)

type StreamableHTTPAdapter struct{}

type jsonRPCRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      any    `json:"id,omitempty"`
	Method  string `json:"method"`
	Params  any    `json:"params,omitempty"`
}

type jsonRPCResponse struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      any           `json:"id"`
	Result  any           `json:"result,omitempty"`
	Error   *jsonRPCError `json:"error,omitempty"`
}

type jsonRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

func NewStreamableHTTPAdapter() *StreamableHTTPAdapter {
	return &StreamableHTTPAdapter{}
}

func (a *StreamableHTTPAdapter) Transport() string {
	return "streamable-http"
}

func (a *StreamableHTTPAdapter) EndpointPath() string {
	return "/mcp"
}

func (a *StreamableHTTPAdapter) Handle(exchange shared.AppMcpHTTPExchange, server shared.AppMcpServer) (*shared.AppMcpHTTPResponse, error) {
	if exchange.Path != a.EndpointPath() {
		return nil, nil
	}

	switch exchange.Method {
	case "GET", "DELETE":
		return &shared.AppMcpHTTPResponse{
			StatusCode: 405,
			Headers: map[string]string{
				"allow":         "POST",
				"cache-control": "no-store",
			},
		}, nil
	case "POST":
	default:
		return &shared.AppMcpHTTPResponse{
			StatusCode: 405,
			Headers: map[string]string{
				"allow":         "GET,POST,DELETE",
				"cache-control": "no-store",
			},
		}, nil
	}

	if stringsTrim(exchange.BodyText) == "" {
		return toJSONResponse(400, failureResponse(nil, -32600, "Missing JSON-RPC payload.", nil)), nil
	}

	var parsed any
	if err := json.Unmarshal([]byte(exchange.BodyText), &parsed); err != nil {
		return toJSONResponse(400, failureResponse(nil, -32700, "Invalid JSON-RPC payload.", err.Error())), nil
	}

	if batch, ok := parsed.([]any); ok && len(batch) == 0 {
		return toJSONResponse(400, failureResponse(nil, -32600, "Empty JSON-RPC batch payload is invalid.", nil)), nil
	}

	messages := []any{parsed}
	if batch, ok := parsed.([]any); ok {
		messages = batch
	}

	responses := []jsonRPCResponse{}
	for _, message := range messages {
		request, hasID, ok := parseJSONRPCMessage(message)
		if !ok {
			responses = append(responses, failureResponse(nil, -32600, "Invalid JSON-RPC request shape.", nil))
			continue
		}
		if !hasID {
			continue
		}

		response := handleJSONRPCRequest(request, server, &shared.AppMcpRequestContext{
			Transport: "streamable-http",
		})
		responses = append(responses, response)
	}

	if len(responses) == 0 {
		return &shared.AppMcpHTTPResponse{
			StatusCode: 202,
			Headers: map[string]string{
				"cache-control": "no-store",
			},
		}, nil
	}

	var body []byte
	var err error
	if len(responses) == 1 {
		body, err = json.Marshal(responses[0])
	} else {
		body, err = json.Marshal(responses)
	}
	if err != nil {
		return nil, err
	}

	return &shared.AppMcpHTTPResponse{
		StatusCode: 200,
		Headers: map[string]string{
			"cache-control": "no-store",
			"content-type":  "application/json; charset=utf-8",
		},
		BodyText: string(body),
	}, nil
}

func parseJSONRPCMessage(value any) (jsonRPCRequest, bool, bool) {
	record, ok := value.(map[string]any)
	if !ok {
		return jsonRPCRequest{}, false, false
	}
	if record["jsonrpc"] != "2.0" {
		return jsonRPCRequest{}, false, false
	}

	method, ok := record["method"].(string)
	if !ok || method == "" {
		return jsonRPCRequest{}, false, false
	}

	request := jsonRPCRequest{
		JSONRPC: "2.0",
		Method:  method,
		Params:  record["params"],
	}

	if id, exists := record["id"]; exists {
		request.ID = id
		return request, true, true
	}

	return request, false, true
}

func handleJSONRPCRequest(request jsonRPCRequest, server shared.AppMcpServer, parent *shared.AppMcpRequestContext) jsonRPCResponse {
	switch request.Method {
	case "initialize":
		params := &shared.AppMcpInitializeParams{}
		if request.Params != nil {
			encoded, _ := json.Marshal(request.Params)
			_ = json.Unmarshal(encoded, params)
		}
		result, err := server.Initialize(params, parent)
		if err != nil {
			return responseFromError(request.ID, err)
		}
		return successResponse(request.ID, result)
	case "ping":
		return successResponse(request.ID, map[string]any{})
	case "tools/list":
		result, err := server.ListTools(parent)
		if err != nil {
			return responseFromError(request.ID, err)
		}
		return successResponse(request.ID, map[string]any{"tools": result})
	case "resources/list":
		result, err := server.ListResources(parent)
		if err != nil {
			return responseFromError(request.ID, err)
		}
		return successResponse(request.ID, map[string]any{"resources": result})
	case "resources/read":
		record, _ := request.Params.(map[string]any)
		uri, _ := record["uri"].(string)
		if uri == "" {
			return failureResponse(request.ID, -32602, "MCP resources/read requires a string resource uri.", nil)
		}
		result, err := server.ReadResource(uri, parent)
		if err != nil {
			return responseFromError(request.ID, err)
		}
		return successResponse(request.ID, result)
	case "tools/call":
		record, _ := request.Params.(map[string]any)
		name, _ := record["name"].(string)
		if name == "" {
			return failureResponse(request.ID, -32602, "MCP tools/call requires a string tool name.", nil)
		}
		result, err := server.CallTool(name, record["arguments"], parent)
		if err != nil {
			return responseFromError(request.ID, err)
		}
		return successResponse(request.ID, result)
	default:
		return failureResponse(request.ID, -32601, fmt.Sprintf("Unsupported MCP method %s.", request.Method), nil)
	}
}

func successResponse(id any, result any) jsonRPCResponse {
	return jsonRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Result:  result,
	}
}

func failureResponse(id any, code int, message string, data any) jsonRPCResponse {
	return jsonRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error: &jsonRPCError{
			Code:    code,
			Message: message,
			Data:    data,
		},
	}
}

func responseFromError(id any, err error) jsonRPCResponse {
	if protocolErr, ok := err.(*shared.AppMcpProtocolError); ok {
		return failureResponse(id, protocolErr.Code, protocolErr.Message, protocolErr.Data)
	}

	return failureResponse(id, -32603, "Internal MCP server error.", map[string]any{
		"message": err.Error(),
	})
}

func toJSONResponse(statusCode int, body jsonRPCResponse) *shared.AppMcpHTTPResponse {
	encoded, _ := json.Marshal(body)
	return &shared.AppMcpHTTPResponse{
		StatusCode: statusCode,
		Headers: map[string]string{
			"cache-control": "no-store",
			"content-type":  "application/json; charset=utf-8",
		},
		BodyText: string(encoded),
	}
}

func stringsTrim(value string) string {
	return strings.TrimSpace(value)
}
