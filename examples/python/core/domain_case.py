# ==========================================================================
# APP v1.1.1
# core/domain_case.py
# --------------------------------------------------------------------------
# Base contract for the domain surface in APP.
#
# Role of this surface:
# - represent the semantic source of truth of a Case
# - define structures, invariants, and pure validations
# - expose structural input/output contracts
#
# The domain MUST NOT:
# - access infrastructure
# - execute side effects
# - know about HTTP, databases, queues, or UI
#
# The domain MAY:
# - expose value objects
# - expose enums
# - validate input semantically
# - expose inputSchema/outputSchema
# - expose semantic examples
# ==========================================================================

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

TInput = TypeVar("TInput")
TOutput = TypeVar("TOutput")
TProps = TypeVar("TProps")


# ==========================================================================
# AppSchema
# --------------------------------------------------------------------------
# Structural APP schema — JSON Schema (Draft 2020-12) compatible subset.
#
# Every AppSchema is a valid JSON Schema. The keywords recognized by the
# protocol are: type, description, properties, items, required, enum,
# additionalProperties.
#
# This allows:
# - MCP tool schemas to be derived from AppSchema without transformation
# - JSON Schema validators to validate inputs directly
# - the protocol to control what tooling needs to support
# ==========================================================================

AppSchema = dict[str, Any]


# ==========================================================================
# DomainExample
# --------------------------------------------------------------------------
# Semantic domain example. Can be used by documentation, tooling, and
# agentic surfaces.
# ==========================================================================

@dataclass
class DomainExample(Generic[TInput, TOutput]):
    """Semantic example for a domain Case."""

    # Short scenario name.
    name: str

    # Scenario input.
    input: TInput

    # Expected output (when applicable).
    output: TOutput | None = None

    # Optional scenario description.
    description: str | None = None

    # Additional notes.
    notes: list[str] | None = None


# ==========================================================================
# ValueObject
# --------------------------------------------------------------------------
# Base class for Value Objects.
#
# Characteristics:
# - immutable
# - comparable by value
# - serializable
# ==========================================================================

class ValueObject(Generic[TProps]):
    """Base class for immutable value objects."""

    def __init__(self, props: TProps) -> None:
        self._props = props

    @property
    def props(self) -> TProps:
        """Return the properties of this value object."""
        return self._props

    def to_json(self) -> TProps:
        """Return a serializable representation."""
        return self._props

    def equals(self, other: ValueObject[TProps] | None) -> bool:
        """
        Compare two value objects by value.

        Uses JSON serialization for comparison.
        In more sensitive domains, this can be overridden.
        """
        if other is None:
            return False
        return json.dumps(self._props, sort_keys=True) == json.dumps(
            other._props, sort_keys=True
        )


# ==========================================================================
# BaseDomainCase
# --------------------------------------------------------------------------
# Base contract for the domain surface.
#
# This class exists to:
# - standardize Case semantics
# - enable introspection by tooling
# - enable controlled derivation by the agentic surface
# ==========================================================================

class BaseDomainCase(ABC, Generic[TInput, TOutput]):
    """Base class for domain surfaces in APP."""

    # ==================================================================
    # Required semantic metadata
    # ==================================================================

    @abstractmethod
    def case_name(self) -> str:
        """
        Canonical Case name.

        Examples: "user_validate", "invoice_pay"
        """
        ...

    @abstractmethod
    def description(self) -> str:
        """
        Semantic description of the capability.

        Should explain what the capability does in domain terms,
        not infrastructure terms.
        """
        ...

    @abstractmethod
    def input_schema(self) -> AppSchema:
        """
        Semantic input schema.

        Represents the conceptual structure expected by the capability,
        not necessarily the technical transport envelope.
        """
        ...

    @abstractmethod
    def output_schema(self) -> AppSchema:
        """
        Semantic output schema.

        Describes the conceptual result of the capability.
        """
        ...

    # ==================================================================
    # Optional sections
    # ==================================================================

    def validate(self, input: TInput) -> None:
        """
        Pure input validation.

        Should raise AppCaseError if the input is invalid from a domain
        perspective. No side effects, no infrastructure access.
        """

    def invariants(self) -> list[str]:
        """
        List of domain invariants.

        Useful for documentation, agents, and future protocol linting.
        """
        return []

    def value_objects(self) -> dict[str, Any]:
        """Value objects exposed by this domain."""
        return {}

    def enums(self) -> dict[str, Any]:
        """Enums exposed by this domain."""
        return {}

    def examples(self) -> list[DomainExample[TInput, TOutput]]:
        """Semantic domain examples."""
        return []

    # ==================================================================
    # Test
    # ==================================================================

    def test(self) -> None:
        """
        Self-contained domain surface test.

        Canonical signature: test() -> None
        Validates schemas, invariants, and examples internally.
        Failures raise via assert or raise.
        """

    # ==================================================================
    # Public utilities
    # ==================================================================

    def definition(self) -> dict[str, Any]:
        """
        Return the consolidated domain definition.

        Useful for tooling, documentation, and agentic derivation.
        """
        return {
            "case_name": self.case_name(),
            "description": self.description(),
            "input_schema": self.input_schema(),
            "output_schema": self.output_schema(),
            "invariants": self.invariants(),
            "value_objects": self.value_objects(),
            "enums": self.enums(),
            "examples": self.examples(),
        }
