/* ========================================================================== *
 * APP v0.0.11
 * core/domain.case.ts
 * ----------------------------------------------------------------------------
 * Contrato base da surface de domínio no APP.
 *
 * Papel desta surface:
 * - representar a fonte de verdade semântica de um Case
 * - definir estruturas, invariantes e validações puras
 * - expor contratos estruturais de entrada e saída
 *
 * O domínio NÃO deve:
 * - acessar infraestrutura
 * - executar side effects
 * - conhecer HTTP, banco, filas ou UI
 *
 * O domínio PODE:
 * - expor value objects
 * - expor enums
 * - validar entrada semanticamente
 * - expor inputSchema/outputSchema
 * - expor exemplos semânticos
 * ========================================================================== */

/**
 * Estrutura genérica de mapa chave/valor.
 */
export type Dict<T = unknown> = Record<string, T>;

/**
 * Schema estrutural do APP — subconjunto compatível de JSON Schema (Draft 2020-12).
 *
 * Todo AppSchema é um JSON Schema válido. As keywords reconhecidas pelo
 * protocolo são: type, description, properties, items, required, enum,
 * additionalProperties. Essas keywords usam a mesma semântica do JSON Schema.
 *
 * Keywords adicionais (format, minimum, pattern, oneOf, $ref, etc.) são
 * permitidas em extensões do host mas não são garantidas pelo tooling canônico.
 *
 * Isso permite que:
 * - MCP tool schemas sejam derivados de AppSchema sem transformação
 * - Validadores JSON Schema (Ajv, etc.) validem inputs diretamente
 * - O protocolo mantenha controle sobre o que o tooling precisa suportar
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
 * Exemplo semântico do domínio.
 *
 * Pode ser usado por:
 * - documentação
 * - tooling
 * - agentic.case.ts
 */
export interface DomainExample<TInput = unknown, TOutput = unknown> {
  /**
   * Nome curto do cenário.
   */
  name: string;

  /**
   * Descrição opcional do cenário.
   */
  description?: string;

  /**
   * Entrada do cenário.
   */
  input: TInput;

  /**
   * Saída esperada, quando aplicável.
   */
  output?: TOutput;

  /**
   * Observações adicionais.
   */
  notes?: string[];
}

/**
 * Classe base para Value Objects.
 *
 * Características:
 * - imutável
 * - comparável por valor
 * - serializável
 */
export abstract class ValueObject<TProps> {
  protected readonly props: Readonly<TProps>;

  constructor(props: TProps) {
    this.props = Object.freeze({ ...props });
  }

  /**
   * Retorna representação serializável do objeto.
   */
  public toJSON(): TProps {
    return this.props as TProps;
  }

  /**
   * Compara dois value objects por valor.
   *
   * Observação:
   * Esta implementação usa serialização simples.
   * Em domínios mais sensíveis, pode ser sobrescrita.
   */
  public equals(other?: ValueObject<TProps>): boolean {
    if (!other) return false;
    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}

/**
 * Contrato base da surface de domínio.
 *
 * Esta classe existe para:
 * - padronizar a semântica do Case
 * - permitir introspecção por tooling
 * - permitir derivação controlada pela surface agentic
 */
export abstract class BaseDomainCase<TInput = unknown, TOutput = unknown> {
  /* ========================================================================
   * Metadados semânticos obrigatórios
   * ====================================================================== */

  /**
   * Nome canônico do Case.
   *
   * Exemplo:
   * - "user_validate"
   * - "invoice_pay"
   */
  public abstract caseName(): string;

  /**
   * Descrição semântica da capacidade.
   *
   * Deve explicar o que a capacidade faz em termos de domínio,
   * e não em termos de infraestrutura.
   */
  public abstract description(): string;

  /**
   * Schema semântico de entrada.
   *
   * Este schema deve representar a estrutura conceitual esperada
   * pela capacidade, e não necessariamente o envelope técnico de transporte.
   */
  public abstract inputSchema(): AppSchema;

  /**
   * Schema semântico de saída.
   *
   * Deve descrever o resultado conceitual da capacidade.
   */
  public abstract outputSchema(): AppSchema;

  /* ========================================================================
   * Seções opcionais
   * ====================================================================== */

  /**
   * Validação pura da entrada.
   *
   * Deve lançar erro se a entrada for inválida do ponto de vista do domínio.
   *
   * Importante:
   * - sem side effects
   * - sem acesso a infraestrutura
   */
  public validate?(input: TInput): void;

  /**
   * Lista de invariantes do domínio.
   *
   * Útil para:
   * - documentação
   * - agentes
   * - lint futuro do protocolo
   */
  public invariants?(): string[];

  /**
   * Value objects expostos por este domínio.
   *
   * Retornar um mapa com nome -> implementação.
   */
  public valueObjects?(): Dict<unknown>;

  /**
   * Enums expostos por este domínio.
   */
  public enums?(): Dict<unknown>;

  /**
   * Exemplos semânticos do domínio.
   */
  public examples?(): DomainExample<TInput, TOutput>[];

  /* ========================================================================
   * Teste
   * ====================================================================== */

  /**
   * Teste interno da surface de domínio.
   *
   * Boa prática recomendada no APP — surfaces idealmente expõem um
   * método test() para validação autocontida do contrato.
   *
   * Assinatura canônica: test(): Promise<void>
   * O teste valida schemas, invariantes e exemplos internamente.
   */
  public async test(): Promise<void> {}

  /* ========================================================================
   * Métodos utilitários públicos
   * ====================================================================== */

  /**
   * Retorna a definição consolidada do domínio.
   *
   * Útil para:
   * - tooling
   * - documentação
   * - derivação agentic
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
