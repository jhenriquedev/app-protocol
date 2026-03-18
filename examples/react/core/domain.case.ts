/* ========================================================================== *
 * APP v1.0.1
 * core/domain.case.ts
 * ----------------------------------------------------------------------------
 * Base contract for the APP domain surface.
 *
 * Role of this surface:
 * - represent the semantic source of truth for a Case
 * - define pure structures, invariants, and validations
 * - expose structural input and output contracts
 *
 * The domain MUST NOT:
 * - access infrastructure
 * - perform side effects
 * - know about HTTP, databases, queues, or UI
 *
 * The domain MAY:
 * - expose value objects
 * - expose enums
 * - validate input semantically
 * - expose inputSchema/outputSchema
 * - expose semantic examples
 * ========================================================================== */

/**
 * Generic key/value map structure.
 */
export type Dict<T = unknown> = Record<string, T>;

/**
 * APP structural schema — compatible subset of JSON Schema (Draft 2020-12).
 *
 * Every AppSchema is a valid JSON Schema. The keywords recognized by the
 * protocol are: type, description, properties, items, required, enum,
 * additionalProperties. These keywords use the same semantics as JSON Schema.
 *
 * Additional keywords (format, minimum, pattern, oneOf, $ref, etc.) are
 * allowed in host extensions but are not guaranteed by canonical tooling.
 *
 * This allows:
 * - MCP tool schemas to be derived from AppSchema without transformation
 * - JSON Schema validators (Ajv, etc.) to validate inputs directly
 * - the protocol to keep control over what tooling needs to support
 */
export type AppSchema = {
  type: string;
  description?: string;
  properties?: Record<string, AppSchema>;
  items?: AppSchema;
  required?: string[];
  enum?: string[];
  additionalProperties?: boolean;
};

/**
 * Semantic domain example.
 *
 * It may be used for:
 * - documentation
 * - tooling
 * - agentic.case.ts
 */
export interface DomainExample<TInput = unknown, TOutput = unknown> {
  /**
   * Short scenario name.
   */
  name: string;

  /**
   * Optional scenario description.
   */
  description?: string;

  /**
   * Scenario input.
   */
  input: TInput;

  /**
   * Expected output, when applicable.
   */
  output?: TOutput;

  /**
   * Additional notes.
   */
  notes?: string[];
}

/**
 * Base class for Value Objects.
 *
 * Characteristics:
 * - immutable
 * - comparable by value
 * - serializable
 */
export abstract class ValueObject<TProps> {
  protected readonly props: Readonly<TProps>;

  constructor(props: TProps) {
    this.props = Object.freeze({ ...props });
  }

  /**
   * Returns a serializable representation of the object.
   */
  public toJSON(): TProps {
    return this.props as TProps;
  }

  /**
   * Compares two value objects by value.
   *
   * Note:
   * This implementation uses simple serialization.
   * In more sensitive domains, it may be overridden.
   */
  public equals(other?: ValueObject<TProps>): boolean {
    if (!other) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}

/**
 * Base contract for the domain surface.
 *
 * This class exists to:
 * - standardize Case semantics
 * - allow introspection by tooling
 * - allow controlled derivation by the agentic surface
 */
export abstract class BaseDomainCase<TInput = unknown, TOutput = unknown> {
  /* ========================================================================
   * Required semantic metadata
   * ====================================================================== */

  /**
   * Canonical Case name.
   *
   * Example:
   * - "user_validate"
   * - "invoice_pay"
   */
  public abstract caseName(): string;

  /**
   * Semantic description of the capability.
   *
   * It must explain what the capability does in domain terms,
   * not in infrastructure terms.
   */
  public abstract description(): string;

  /**
   * Semantic input schema.
   *
   * This schema must represent the conceptual structure expected
   * by the capability, not necessarily the technical transport envelope.
   */
  public abstract inputSchema(): AppSchema;

  /**
   * Semantic output schema.
   *
   * It must describe the conceptual result of the capability.
   */
  public abstract outputSchema(): AppSchema;

  /* ========================================================================
   * Optional sections
   * ====================================================================== */

  /**
   * Pure input validation.
   *
   * It must throw if the input is invalid from a domain perspective.
   *
   * Important:
   * - no side effects
   * - no infrastructure access
   */
  public validate?(input: TInput): void;

  /**
   * List of domain invariants.
   *
   * Useful for:
   * - documentation
   * - agents
   * - future protocol linting
   */
  public invariants?(): string[];

  /**
   * Value objects exposed by this domain.
   *
   * Return a name -> implementation map.
   */
  public valueObjects?(): Dict<unknown>;

  /**
   * Enums exposed by this domain.
   */
  public enums?(): Dict<unknown>;

  /**
   * Semantic domain examples.
   */
  public examples?(): DomainExample<TInput, TOutput>[];

  /* ========================================================================
   * Teste
   * ====================================================================== */

  /**
   * Internal test for the domain surface.
   *
   * Recommended APP practice — surfaces should ideally expose a
   * test() method for self-contained contract validation.
   *
   * Canonical signature: test(): Promise<void>
   * The test validates schemas, invariants, and examples internally.
   */
  public async test(): Promise<void> {}

  /* ========================================================================
   * Public utility methods
   * ====================================================================== */

  /**
   * Returns the consolidated domain definition.
   *
   * Useful for:
   * - tooling
   * - documentation
   * - agentic derivation
   */
  public definition() {
    return {
      caseName: this.caseName(),
      description: this.description(),
      inputSchema: this.inputSchema(),
      outputSchema: this.outputSchema(),
      invariants: this.invariants?.() ?? [],
      valueObjects: this.valueObjects?.() ?? {},
      enums: this.enums?.() ?? {},
      examples: this.examples?.() ?? [],
    };
  }
}
