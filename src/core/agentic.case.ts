/* ========================================================================== *
 * APP v0.0.2
 * core/agentic.case.ts
 * ----------------------------------------------------------------------------
 * Contrato base da surface agentic no APP.
 *
 * Papel desta surface:
 * - tornar um Case compreensível por agentes
 * - expor descoberta, contexto, prompt, tool, MCP e RAG
 * - manter a execução real apontando para surfaces canônicas do Case
 *
 * Regra fundamental:
 * - agentic.case.ts NÃO reimplementa a lógica principal da capacidade
 * - agentic.case.ts descreve e opera a capacidade via contratos estruturados
 *
 * Integração com domain.case.ts:
 * - esta base permite derivar schema, descrição e exemplos do domínio
 * - isso reduz duplicação semântica e drift entre domínio e tool
 * ========================================================================== */

import {
  AppSchema,
  BaseDomainCase,
  Dict,
  DomainExample,
} from "./domain.case";

/* ==========================================================================
 * Contexto base do runtime APP
 * ========================================================================== */

/**
 * Contexto canônico injetado no runtime.
 *
 * Este contrato é propositalmente neutro.
 * Cada projeto APP pode estendê-lo conforme necessário.
 */
export interface AppContext {
  tenantId?: string;
  userId?: string;
  auth?: unknown;

  logger: {
    debug(message: string, meta?: Dict): void;
    info(message: string, meta?: Dict): void;
    warn(message: string, meta?: Dict): void;
    error(message: string, meta?: Dict): void;
  };

  http?: unknown;
  db?: unknown;
  storage?: unknown;
  cache?: unknown;
  eventBus?: unknown;
  config?: Dict;

  /**
   * Registro opcional de Cases carregados pelo runtime.
   */
  cases?: Dict;

  /**
   * Espaço de extensão livre para o host do projeto.
   */
  extra?: Dict;
}

/* ==========================================================================
 * Discovery
 * ========================================================================== */

export interface AgenticDiscovery {
  /**
   * Nome canônico do Case.
   */
  name: string;

  /**
   * Descrição curta e clara da capacidade.
   */
  description: string;

  /**
   * Categoria semântica.
   * Exemplo: "users", "billing"
   */
  category?: string;

  /**
   * Tags auxiliares para indexação.
   */
  tags?: string[];

  /**
   * Nomes alternativos ou aliases.
   */
  aliases?: string[];

  /**
   * Capacidades representadas pelo Case.
   */
  capabilities?: string[];

  /**
   * Intenções de uso.
   */
  intents?: string[];
}

/* ==========================================================================
 * Contexto de execução para agentes
 * ========================================================================== */

export interface AgenticExecutionContext {
  /**
   * Indica se autenticação é obrigatória.
   */
  requiresAuth?: boolean;

  /**
   * Indica se tenant é obrigatório.
   */
  requiresTenant?: boolean;

  /**
   * Dependências semânticas ou superfícies relacionadas.
   * Exemplo: ["user_validate.api", "user_validate.domain"]
   */
  dependencies?: string[];

  /**
   * Pré-condições para uso da capacidade.
   */
  preconditions?: string[];

  /**
   * Restrições de uso.
   */
  constraints?: string[];

  /**
   * Observações auxiliares.
   */
  notes?: string[];
}

/* ==========================================================================
 * Prompt estruturado
 * ========================================================================== */

export interface AgenticPrompt {
  /**
   * Objetivo principal da capacidade.
   */
  purpose: string;

  /**
   * Quando usar.
   */
  whenToUse?: string[];

  /**
   * Quando não usar.
   */
  whenNotToUse?: string[];

  /**
   * Restrições específicas.
   */
  constraints?: string[];

  /**
   * Hints de raciocínio para agentes.
   */
  reasoningHints?: string[];

  /**
   * Resultado esperado em linguagem natural.
   */
  expectedOutcome?: string;
}

/* ==========================================================================
 * Tool contract
 * ========================================================================== */

export interface AgenticToolContract<TInput = unknown, TOutput = unknown> {
  /**
   * Nome canônico da tool.
   */
  name: string;

  /**
   * Descrição curta da tool.
   */
  description: string;

  /**
   * Schema de entrada.
   */
  inputSchema: AppSchema;

  /**
   * Schema de saída.
   */
  outputSchema: AppSchema;

  /**
   * Indica se a tool causa side effects.
   */
  isMutating?: boolean;

  /**
   * Indica se a execução exige confirmação explícita.
   */
  requiresConfirmation?: boolean;

  /**
   * Execução real da tool.
   *
   * Regra:
   * deve apontar para a implementação canônica do Case.
   */
  execute(input: TInput, ctx: AppContext): Promise<TOutput>;
}

/* ==========================================================================
 * MCP
 * ========================================================================== */

export interface AgenticMcpContract {
  /**
   * Nome da tool exposta via MCP.
   */
  toolName: string;

  /**
   * Título amigável.
   */
  title: string;

  /**
   * Descrição da exposição MCP.
   */
  description: string;

  /**
   * Indica se a exposição está ativa.
   */
  enabled?: boolean;

  /**
   * Metadados extras para adapters MCP.
   */
  metadata?: Dict;
}

/* ==========================================================================
 * RAG
 * ========================================================================== */

export interface AgenticRagContract {
  /**
   * Fontes preferidas para recuperação contextual.
   */
  sources?: string[];

  /**
   * Dicas de recuperação.
   */
  hints?: string[];

  /**
   * Escopo máximo permitido.
   */
  scope?: "case-local" | "project" | "org-approved";

  /**
   * Modo de uso do RAG.
   */
  mode?: "disabled" | "optional" | "recommended" | "required";
}

/* ==========================================================================
 * Policy
 * ========================================================================== */

export interface AgenticPolicy {
  /**
   * Exige confirmação explícita antes da execução.
   */
  requireConfirmation?: boolean;

  /**
   * Exige autenticação.
   */
  requireAuth?: boolean;

  /**
   * Exige tenant.
   */
  requireTenant?: boolean;

  /**
   * Nível de risco operacional.
   */
  riskLevel?: "low" | "medium" | "high";

  /**
   * Modo de execução permitido para agentes.
   */
  executionMode?: "suggest-only" | "manual-approval" | "direct-execution";

  /**
   * Limites textuais adicionais.
   */
  limits?: string[];
}

/* ==========================================================================
 * Examples
 * ========================================================================== */

export interface AgenticExample<TInput = unknown, TOutput = unknown> {
  name: string;
  description?: string;
  input: TInput;
  output: TOutput;
  notes?: string[];
}

/* ==========================================================================
 * Definição consolidada
 * ========================================================================== */

export interface AgenticDefinition<TInput = unknown, TOutput = unknown> {
  discovery: AgenticDiscovery;
  context: AgenticExecutionContext;
  prompt: AgenticPrompt;
  tool: AgenticToolContract<TInput, TOutput>;
  mcp?: AgenticMcpContract;
  rag?: AgenticRagContract;
  policy?: AgenticPolicy;
  examples?: AgenticExample<TInput, TOutput>[];
}

/* ==========================================================================
 * Classe base
 * ========================================================================== */

/**
 * Classe base canônica para agentic.case.ts
 *
 * Esta classe suporta dois modos:
 *
 * 1. Implementação manual
 *    A surface agentic define tudo explicitamente.
 *
 * 2. Implementação derivada do domínio
 *    A surface agentic reutiliza descrição, schemas e exemplos do domain.case.ts.
 */
export abstract class BaseAgenticCase<TInput = unknown, TOutput = unknown> {
  protected readonly ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  /* ========================================================================
   * Conexão opcional com o domínio
   * ====================================================================== */

  /**
   * Retorna a instância do domínio local do Case, quando existir.
   *
   * Esta conexão permite:
   * - derivar description
   * - derivar inputSchema/outputSchema
   * - derivar examples
   *
   * Observação:
   * A implementação concreta decide se quer ou não usar o domínio como base.
   */
  protected domain():
    | BaseDomainCase<TInput, TOutput>
    | undefined {
    return undefined;
  }

  /* ========================================================================
   * Seções obrigatórias
   * ====================================================================== */

  /**
   * Metadados de descoberta.
   */
  public abstract discovery(): AgenticDiscovery;

  /**
   * Contexto mínimo necessário para operação correta do Case.
   */
  public abstract context(): AgenticExecutionContext;

  /**
   * Prompt estruturado para agentes.
   */
  public abstract prompt(): AgenticPrompt;

  /**
   * Contrato de tool.
   *
   * Regra mais importante:
   * a tool deve apontar para a execução canônica do Case.
   */
  public abstract tool(): AgenticToolContract<TInput, TOutput>;

  /* ========================================================================
   * Seções opcionais
   * ====================================================================== */

  public mcp(): AgenticMcpContract | undefined {
    return undefined;
  }

  public rag(): AgenticRagContract | undefined {
    return undefined;
  }

  public policy(): AgenticPolicy | undefined {
    return undefined;
  }

  public examples(): AgenticExample<TInput, TOutput>[] {
    const domainExamples = this.domainExamples();
    return domainExamples ?? [];
  }

  /* ========================================================================
   * Helpers de derivação a partir do domínio
   * ====================================================================== */

  /**
   * Deriva a descrição a partir do domínio, quando disponível.
   */
  protected domainDescription(): string | undefined {
    return this.domain()?.description();
  }

  /**
   * Deriva o nome canônico a partir do domínio, quando disponível.
   */
  protected domainCaseName(): string | undefined {
    return this.domain()?.caseName();
  }

  /**
   * Deriva o schema de entrada a partir do domínio, quando disponível.
   */
  protected domainInputSchema(): AppSchema | undefined {
    return this.domain()?.inputSchema();
  }

  /**
   * Deriva o schema de saída a partir do domínio, quando disponível.
   */
  protected domainOutputSchema(): AppSchema | undefined {
    return this.domain()?.outputSchema();
  }

  /**
   * Deriva exemplos do domínio e os converte para examples agentic.
   */
  protected domainExamples():
    | AgenticExample<TInput, TOutput>[]
    | undefined {
    const examples = this.domain()?.examples?.();
    if (!examples || examples.length === 0) return undefined;

    return examples
      .filter(
        (item): item is DomainExample<TInput, TOutput> & { output: TOutput } =>
          item.output !== undefined
      )
      .map((item) => ({
        name: item.name,
        description: item.description,
        input: item.input,
        output: item.output,
        notes: item.notes,
      }));
  }

  /* ========================================================================
   * Métodos públicos utilitários
   * ====================================================================== */

  /**
   * Retorna a definição consolidada do Agentic Protocol.
   */
  public definition(): AgenticDefinition<TInput, TOutput> {
    return {
      discovery: this.discovery(),
      context: this.context(),
      prompt: this.prompt(),
      tool: this.tool(),
      mcp: this.mcp(),
      rag: this.rag(),
      policy: this.policy(),
      examples: this.examples(),
    };
  }

  /**
   * Atalho seguro para executar a tool.
   */
  public async execute(input: TInput): Promise<TOutput> {
    return this.tool().execute(input, this.ctx);
  }

  /**
   * Indica se a surface agentic está apta para exposição MCP.
   */
  public isMcpEnabled(): boolean {
    const contract = this.mcp();
    return Boolean(contract?.enabled ?? contract);
  }

  /**
   * Indica se a execução exige confirmação.
   *
   * Esta decisão considera tanto policy quanto tool contract.
   */
  public requiresConfirmation(): boolean {
    return Boolean(
      this.policy()?.requireConfirmation ||
      this.tool().requiresConfirmation
    );
  }

  /**
   * Retorna o nome canônico do Case.
   *
   * Prioridade:
   * 1. discovery.name
   * 2. domínio, se houver
   */
  public caseName(): string {
    return this.discovery().name || this.domainCaseName() || "unknown_case";
  }

  /* ========================================================================
   * Hook opcional de validação interna
   * ====================================================================== */

  /**
   * Pode ser sobrescrito por subclasses para validar consistência
   * entre discovery, prompt, tool, domain e examples.
   */
  protected validateDefinition(): void {
    // Implementação padrão vazia.
  }
}
