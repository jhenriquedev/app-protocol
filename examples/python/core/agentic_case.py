# ==========================================================================
# APP v1.1.3
# core/agentic_case.py
# --------------------------------------------------------------------------
# Base contract for the agentic surface in APP.
#
# Role of this surface:
# - make a Case understandable by agents
# - expose discovery, context, prompt, tool, MCP, and RAG
# - keep real execution pointing to canonical Case surfaces
#
# Fundamental rule:
# - agentic_case.py does NOT reimplement the main capability logic
# - agentic_case.py describes and operates the capability via structured contracts
#
# Integration with domain_case.py:
# - this base allows deriving schema, description, and examples from the domain
# - reduces semantic duplication and drift between domain and tool
#
# Context:
# - AgenticContext extends AppBaseContext with agentic infrastructure
# - includes Cases registry and MCP runtime information
# ==========================================================================

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Generic, Literal, TypeVar

from core.domain_case import AppSchema, BaseDomainCase, DomainExample
from core.shared.app_base_context import AppBaseContext

TInput = TypeVar("TInput")
TOutput = TypeVar("TOutput")


# ==========================================================================
# AgenticContext
# ==========================================================================

class AgenticContext(AppBaseContext, total=False):
    """Context for the agentic surface."""

    # Cases loaded by the runtime (for tool execution delegation).
    cases: dict[str, Any]

    # Library packages registered by the host.
    packages: dict[str, Any]

    # MCP runtime information (when available).
    mcp: Any

    # Free extension space for the host.
    extra: dict[str, Any]


# ==========================================================================
# Discovery
# ==========================================================================

@dataclass
class AgenticDiscovery:
    """Discovery metadata for an agentic Case."""

    # Canonical Case name.
    name: str

    # Short, clear capability description.
    description: str

    # Semantic category (e.g. "users", "billing").
    category: str | None = None

    # Auxiliary tags for indexing.
    tags: list[str] = field(default_factory=list)

    # Alternative names or aliases.
    aliases: list[str] = field(default_factory=list)

    # Capabilities represented by the Case.
    capabilities: list[str] = field(default_factory=list)

    # Usage intents.
    intents: list[str] = field(default_factory=list)


# ==========================================================================
# Execution context for agents
# ==========================================================================

@dataclass
class AgenticExecutionContext:
    """Execution context metadata for agent operation."""

    requires_auth: bool = False
    requires_tenant: bool = False

    # Semantic dependencies or related surfaces.
    dependencies: list[str] = field(default_factory=list)

    # Preconditions for using the capability.
    preconditions: list[str] = field(default_factory=list)

    # Usage constraints.
    constraints: list[str] = field(default_factory=list)

    # Auxiliary notes.
    notes: list[str] = field(default_factory=list)


# ==========================================================================
# Structured prompt
# ==========================================================================

@dataclass
class AgenticPrompt:
    """Structured prompt for agents."""

    # Main capability purpose.
    purpose: str

    # When to use.
    when_to_use: list[str] = field(default_factory=list)

    # When NOT to use.
    when_not_to_use: list[str] = field(default_factory=list)

    # Specific constraints.
    constraints: list[str] = field(default_factory=list)

    # Reasoning hints for agents.
    reasoning_hints: list[str] = field(default_factory=list)

    # Expected outcome in natural language.
    expected_outcome: str | None = None


# ==========================================================================
# Tool contract
# ==========================================================================

@dataclass
class AgenticToolContract(Generic[TInput, TOutput]):
    """Tool contract for agentic execution."""

    # Canonical tool name.
    name: str

    # Short tool description.
    description: str

    # Input schema.
    input_schema: AppSchema

    # Output schema.
    output_schema: AppSchema

    # Whether the tool causes side effects.
    is_mutating: bool = False

    # Whether execution requires explicit confirmation.
    requires_confirmation: bool = False

    # Execution function — must delegate to a canonical surface.
    execute: Any = None  # Callable[[TInput, AgenticContext], TOutput]


# ==========================================================================
# MCP contract
# --------------------------------------------------------------------------
# Fallback rules (normative — adapters must follow):
# - name:        uses mcp.name if provided, otherwise tool.name
# - description: uses mcp.description if provided, otherwise tool.description
# - title:       uses mcp.title if provided; otherwise derived from tool.name
# - schemas:     always derived from tool
# - execute:     always delegates to tool.execute()
# ==========================================================================

@dataclass
class AgenticMcpContract:
    """MCP exposure configuration for a Case."""

    # Whether this Case should be exposed via MCP.
    enabled: bool = True

    # MCP tool name (falls back to tool.name).
    name: str | None = None

    # MCP human-readable title.
    title: str | None = None

    # MCP tool description (falls back to tool.description).
    description: str | None = None

    # Additional metadata for MCP adapters.
    metadata: dict[str, Any] = field(default_factory=dict)


# ==========================================================================
# RAG contract
# ==========================================================================

RagResourceKind = Literal["case", "file"]


@dataclass
class RagResource:
    """Concrete reference to a knowledge artifact."""

    kind: RagResourceKind
    ref: str
    description: str | None = None


@dataclass
class AgenticRagContract:
    """RAG contract for agent knowledge retrieval."""

    # Normalized semantic labels of the relevant knowledge domain.
    topics: list[str] = field(default_factory=list)

    # Concrete references to knowledge artifacts.
    resources: list[RagResource] = field(default_factory=list)

    # Free-form reasoning hints for the agent.
    hints: list[str] = field(default_factory=list)

    # Maximum scope for contextual retrieval.
    scope: Literal["case-local", "project", "org-approved"] | None = None

    # Degree of dependency on external context.
    mode: Literal["disabled", "optional", "recommended", "required"] | None = None


# ==========================================================================
# Policy
# ==========================================================================

@dataclass
class AgenticPolicy:
    """Agentic execution policy."""

    require_confirmation: bool = False
    require_auth: bool = False
    require_tenant: bool = False
    risk_level: Literal["low", "medium", "high"] | None = None
    execution_mode: Literal["suggest-only", "manual-approval", "direct-execution"] | None = None
    limits: list[str] = field(default_factory=list)


# ==========================================================================
# Example
# ==========================================================================

@dataclass
class AgenticExample(Generic[TInput, TOutput]):
    """Agentic example for agent guidance."""

    name: str
    input: TInput
    output: TOutput
    description: str | None = None
    notes: list[str] = field(default_factory=list)


# ==========================================================================
# Consolidated definition
# ==========================================================================

@dataclass
class AgenticDefinition(Generic[TInput, TOutput]):
    """Complete agentic definition for a Case."""

    discovery: AgenticDiscovery
    context: AgenticExecutionContext
    prompt: AgenticPrompt
    tool: AgenticToolContract[TInput, TOutput]
    mcp: AgenticMcpContract | None = None
    rag: AgenticRagContract | None = None
    policy: AgenticPolicy | None = None
    examples: list[AgenticExample[TInput, TOutput]] = field(default_factory=list)


# ==========================================================================
# BaseAgenticCase
# --------------------------------------------------------------------------
# Canonical base class for agentic surfaces.
#
# Supports two modes:
# 1. Manual implementation — the surface defines everything explicitly.
# 2. Domain-derived — reuses description, schemas, and examples from domain.
# ==========================================================================

class BaseAgenticCase(ABC, Generic[TInput, TOutput]):
    """Base class for agentic surfaces in APP."""

    def __init__(self, ctx: AgenticContext) -> None:
        self.ctx = ctx

    # ==================================================================
    # Optional domain connection
    # ==================================================================

    def domain(self) -> BaseDomainCase[TInput, TOutput] | None:
        """
        Return the local domain instance, when available.

        Enables deriving description, schemas, and examples from the domain.
        """
        return None

    # ==================================================================
    # Required sections
    # ==================================================================

    @abstractmethod
    def discovery(self) -> AgenticDiscovery:
        """Discovery metadata."""
        ...

    @abstractmethod
    def context(self) -> AgenticExecutionContext:
        """Minimum context needed for correct operation."""
        ...

    @abstractmethod
    def prompt(self) -> AgenticPrompt:
        """Structured prompt for agents."""
        ...

    @abstractmethod
    def tool(self) -> AgenticToolContract[TInput, TOutput]:
        """
        Tool contract.

        Most important rule: the tool must delegate to the canonical
        Case execution (e.g. ctx.cases.tasks.task_create.api.handler).
        """
        ...

    def test(self) -> None:
        """
        Self-contained agentic surface test.

        Should verify at minimum:
        - definition() returns a valid contract (validate_definition)
        - discovery, context, prompt, and tool are consistent
        - tool.execute() produces expected results for known inputs
        """

    # ==================================================================
    # Optional sections
    # ==================================================================

    def mcp(self) -> AgenticMcpContract | None:
        """MCP exposure configuration."""
        return None

    def rag(self) -> AgenticRagContract | None:
        """RAG knowledge retrieval contract."""
        return None

    def policy(self) -> AgenticPolicy | None:
        """Execution policy."""
        return None

    def examples(self) -> list[AgenticExample[TInput, TOutput]]:
        """Agentic examples. Falls back to domain examples when available."""
        domain_examples = self.domain_examples()
        return domain_examples if domain_examples is not None else []

    # ==================================================================
    # Domain derivation helpers
    # ==================================================================

    def domain_description(self) -> str | None:
        """Derive description from the domain, when available."""
        d = self.domain()
        return d.description() if d is not None else None

    def domain_case_name(self) -> str | None:
        """Derive canonical name from the domain, when available."""
        d = self.domain()
        return d.case_name() if d is not None else None

    def domain_input_schema(self) -> AppSchema | None:
        """Derive input schema from the domain, when available."""
        d = self.domain()
        return d.input_schema() if d is not None else None

    def domain_output_schema(self) -> AppSchema | None:
        """Derive output schema from the domain, when available."""
        d = self.domain()
        return d.output_schema() if d is not None else None

    def domain_examples(self) -> list[AgenticExample[TInput, TOutput]] | None:
        """Derive examples from the domain and convert to agentic format."""
        d = self.domain()
        if d is None:
            return None

        raw = d.examples()
        if not raw:
            return None

        result: list[AgenticExample[TInput, TOutput]] = []
        for item in raw:
            if item.output is not None:
                result.append(
                    AgenticExample(
                        name=item.name,
                        description=item.description,
                        input=item.input,
                        output=item.output,
                        notes=item.notes if item.notes else [],
                    )
                )
        return result if result else None

    # ==================================================================
    # Public utilities
    # ==================================================================

    def definition(self) -> AgenticDefinition[TInput, TOutput]:
        """Return the consolidated agentic definition."""
        return AgenticDefinition(
            discovery=self.discovery(),
            context=self.context(),
            prompt=self.prompt(),
            tool=self.tool(),
            mcp=self.mcp(),
            rag=self.rag(),
            policy=self.policy(),
            examples=self.examples(),
        )

    def execute(self, input: TInput) -> TOutput:
        """Shortcut to execute the tool."""
        t = self.tool()
        return t.execute(input, self.ctx)

    def is_mcp_enabled(self) -> bool:
        """Whether this surface is ready for MCP exposure."""
        contract = self.mcp()
        return contract is not None and contract.enabled is not False

    def requires_confirmation(self) -> bool:
        """
        Whether execution requires explicit confirmation.

        Considers both policy and tool contract.
        """
        p = self.policy()
        t = self.tool()
        return bool(
            (p is not None and p.require_confirmation)
            or t.requires_confirmation
        )

    def case_name(self) -> str:
        """
        Canonical Case name.

        Priority: discovery.name > domain case_name > "unknown_case"
        """
        name = self.discovery().name
        if name:
            return name
        domain_name = self.domain_case_name()
        return domain_name if domain_name else "unknown_case"

    # ==================================================================
    # Internal validation hook
    # ==================================================================

    def validate_definition(self) -> None:
        """
        Validate internal consistency of the agentic definition.

        Checks minimal structural invariants. Subclasses can override
        for additional validation.
        """
        d = self.discovery()
        if not d.name:
            raise ValueError("validate_definition: discovery.name is empty")
        if not d.description:
            raise ValueError("validate_definition: discovery.description is empty")

        t = self.tool()
        if not t.name:
            raise ValueError("validate_definition: tool.name is empty")
        if t.execute is None:
            raise ValueError("validate_definition: tool.execute is missing")

        p = self.prompt()
        if not p.purpose:
            raise ValueError("validate_definition: prompt.purpose is empty")

        m = self.mcp()
        if m is not None and m.enabled and not m.name:
            raise ValueError("validate_definition: mcp.enabled but mcp.name is empty")
