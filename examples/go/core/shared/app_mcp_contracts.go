package shared

type AppMcpClientInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type AppMcpServerInfo struct {
	Name            string `json:"name"`
	Version         string `json:"version"`
	ProtocolVersion string `json:"protocolVersion"`
	Instructions    string `json:"instructions,omitempty"`
}

type AppMcpInitializeParams struct {
	ProtocolVersion string            `json:"protocolVersion"`
	Capabilities    Dict              `json:"capabilities,omitempty"`
	ClientInfo      *AppMcpClientInfo `json:"clientInfo,omitempty"`
}

type AppMcpInitializeResult struct {
	ProtocolVersion string `json:"protocolVersion"`
	Capabilities    struct {
		Tools struct {
			ListChanged bool `json:"listChanged"`
		} `json:"tools,omitempty"`
		Resources struct {
			ListChanged bool `json:"listChanged"`
		} `json:"resources,omitempty"`
	} `json:"capabilities"`
	ServerInfo struct {
		Name    string `json:"name"`
		Version string `json:"version"`
	} `json:"serverInfo"`
	Instructions string `json:"instructions,omitempty"`
}

type AppMcpTextContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type AppMcpToolDescriptor struct {
	Name         string    `json:"name"`
	Title        string    `json:"title,omitempty"`
	Description  string    `json:"description,omitempty"`
	InputSchema  AppSchema `json:"inputSchema"`
	OutputSchema AppSchema `json:"outputSchema,omitempty"`
	Annotations  Dict      `json:"annotations,omitempty"`
}

type AppMcpResourceDescriptor struct {
	URI         string `json:"uri"`
	Name        string `json:"name"`
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
	MimeType    string `json:"mimeType,omitempty"`
	Annotations Dict   `json:"annotations,omitempty"`
}

type AppMcpTextResourceContent struct {
	URI      string `json:"uri"`
	MimeType string `json:"mimeType,omitempty"`
	Text     string `json:"text"`
}

type AppMcpCallResult struct {
	Content           []AppMcpTextContent `json:"content"`
	StructuredContent any                 `json:"structuredContent,omitempty"`
	IsError           bool                `json:"isError,omitempty"`
}

type AppMcpReadResourceResult struct {
	Contents []AppMcpTextResourceContent `json:"contents"`
}

type AppMcpRequestContext struct {
	Transport       string            `json:"transport"`
	RequestID       any               `json:"requestId,omitempty"`
	SessionID       string            `json:"sessionId,omitempty"`
	CorrelationID   string            `json:"correlationId,omitempty"`
	ClientInfo      *AppMcpClientInfo `json:"clientInfo,omitempty"`
	ProtocolVersion string            `json:"protocolVersion,omitempty"`
}

type AppMcpServer interface {
	ServerInfo() AppMcpServerInfo
	Initialize(params *AppMcpInitializeParams, parent *AppMcpRequestContext) (AppMcpInitializeResult, error)
	ListTools(parent *AppMcpRequestContext) ([]AppMcpToolDescriptor, error)
	ListResources(parent *AppMcpRequestContext) ([]AppMcpResourceDescriptor, error)
	ReadResource(uri string, parent *AppMcpRequestContext) (AppMcpReadResourceResult, error)
	CallTool(name string, args any, parent *AppMcpRequestContext) (AppMcpCallResult, error)
}

type BaseAppMcpAdapter interface {
	Transport() string
}

type BaseAppMcpProcessAdapter interface {
	BaseAppMcpAdapter
	Serve(server AppMcpServer) error
}

type AppMcpHTTPExchange struct {
	Method   string
	Path     string
	Headers  map[string]string
	BodyText string
}

type AppMcpHTTPResponse struct {
	StatusCode int
	Headers    map[string]string
	BodyText   string
}

type BaseAppMcpHTTPAdapter interface {
	BaseAppMcpAdapter
	EndpointPath() string
	Handle(exchange AppMcpHTTPExchange, server AppMcpServer) (*AppMcpHTTPResponse, error)
}

type AppMcpProtocolError struct {
	Code    int
	Message string
	Data    any
}

func (e *AppMcpProtocolError) Error() string {
	return e.Message
}
