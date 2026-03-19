package shared

type DomainFactory func() any
type ContextualFactory func(ctx any) any

type AppCaseSurfaces struct {
	Domain  DomainFactory
	API     ContextualFactory
	UI      ContextualFactory
	Stream  ContextualFactory
	Agentic ContextualFactory
}

type AgenticCaseRef struct {
	Domain   string `json:"domain"`
	CaseName string `json:"caseName"`
}

type AgenticCatalogEntry struct {
	Ref                  AgenticCaseRef `json:"ref"`
	PublishedName        string         `json:"publishedName"`
	Definition           any            `json:"definition"`
	IsMcpEnabled         bool           `json:"isMcpEnabled"`
	RequiresConfirmation bool           `json:"requiresConfirmation"`
	ExecutionMode        string         `json:"executionMode"`
}

type AppRegistry interface {
	Cases() map[string]map[string]AppCaseSurfaces
	Providers() Dict
	Packages() Dict
}

type AgenticRegistry interface {
	AppRegistry
	ListAgenticCases() []AgenticCaseRef
	GetAgenticSurface(ref AgenticCaseRef) ContextualFactory
	InstantiateAgentic(ref AgenticCaseRef, ctx any) (any, error)
	BuildCatalog(ctx any) ([]AgenticCatalogEntry, error)
	ResolveTool(toolName string, ctx any) (*AgenticCatalogEntry, error)
	ListMcpEnabledTools(ctx any) ([]AgenticCatalogEntry, error)
}
