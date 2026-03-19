package agent

import (
	"bufio"
	"encoding/json"
	"os"

	"app-protocol/examples/go/core/shared"
)

type StdioAdapter struct{}

func NewStdioAdapter() *StdioAdapter {
	return &StdioAdapter{}
}

func (a *StdioAdapter) Transport() string {
	return "stdio"
}

func (a *StdioAdapter) Serve(server shared.AppMcpServer) error {
	sessionID := shared.NewID()
	phase := "awaiting_initialize"
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	writer := bufio.NewWriter(os.Stdout)
	defer writer.Flush()

	for scanner.Scan() {
		line := scanner.Text()
		if stringsTrim(line) == "" {
			continue
		}

		var message any
		if err := json.Unmarshal([]byte(line), &message); err != nil {
			if err := writeJSONRPCResponse(writer, failureResponse(nil, -32700, "Invalid JSON-RPC payload.", err.Error())); err != nil {
				return err
			}
			continue
		}

		request, hasID, ok := parseJSONRPCMessage(message)
		if !ok {
			if err := writeJSONRPCResponse(writer, failureResponse(nil, -32600, "Invalid JSON-RPC request shape.", nil)); err != nil {
				return err
			}
			continue
		}

		if !hasID {
			if request.Method == "notifications/initialized" && phase == "awaiting_initialized_notification" {
				phase = "ready"
			}
			continue
		}

		context := &shared.AppMcpRequestContext{
			Transport: "stdio",
			SessionID: sessionID,
		}

		response := a.handleRequestWithPhase(request, server, context, &phase)
		if err := writeJSONRPCResponse(writer, response); err != nil {
			return err
		}
	}

	return scanner.Err()
}

func (a *StdioAdapter) handleRequestWithPhase(request jsonRPCRequest, server shared.AppMcpServer, context *shared.AppMcpRequestContext, phase *string) jsonRPCResponse {
	switch request.Method {
	case "initialize":
		if *phase != "awaiting_initialize" {
			return failureResponse(request.ID, -32600, "MCP initialize may only run once per stdio session.", nil)
		}
		params := &shared.AppMcpInitializeParams{}
		if request.Params != nil {
			encoded, _ := json.Marshal(request.Params)
			_ = json.Unmarshal(encoded, params)
		}
		result, err := server.Initialize(params, context)
		if err != nil {
			return responseFromError(request.ID, err)
		}
		*phase = "awaiting_initialized_notification"
		return successResponse(request.ID, result)
	case "ping", "tools/list", "resources/list", "resources/read", "tools/call":
		if *phase != "ready" {
			return failureResponse(request.ID, -32002, "MCP session is not ready; complete initialization first.", nil)
		}
		return handleJSONRPCRequest(request, server, context)
	default:
		return handleJSONRPCRequest(request, server, context)
	}
}

func writeJSONRPCResponse(writer *bufio.Writer, response jsonRPCResponse) error {
	encoded, err := json.Marshal(response)
	if err != nil {
		return err
	}

	if _, err := writer.WriteString(string(encoded) + "\n"); err != nil {
		return err
	}

	return writer.Flush()
}
