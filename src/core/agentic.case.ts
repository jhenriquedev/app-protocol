/* ========================================================================== *
 * APP v0.0.9
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
 *
 * Contexto:
 * - AgenticContext estende AppBaseContext com infraestrutura agentic
 * - inclui registry de Cases e informações de runtime MCP
 * ========================================================================== */

import {
  AppSchema,
  BaseDomainCase,
  Dict,
  DomainExample,
} from "./domain.case";

import { AppBaseContext } from "./shared/app_base_context";

/* ==========================================================================
 * AgenticContext
 * --------------------------------------------------------------------------
 * Contexto específico da surface agentic.
 *
 * Estende AppBaseContext com infraestrutura de operação agentic:
 * - cases: registro de Cases carregados pelo runtime (para resolução de tools)
 * - mcp: informações do runtime MCP, quando disponível
 *
 * O campo cases é essencial para que a tool do agentic consiga
 * apontar para a execução canônica via ctx.cases.
 * ========================================================================== */

export interface AgenticContext extends AppBaseContext {
  /**
   * Registro de Cases carregados pelo runtime.
   *
   * Usado pela tool para resolver a execução canônica do Case.
   *
   * Exemplo de acesso:
   * ctx.cases?.users?.user_validate?.api?.handler(input)
   */
  cases?: Dict;

  /**
   * Packages de biblioteca registrados pelo host.
   *
   * Expostos via registry._packages.
   * Bibliotecas puras de packages/ que o app disponibiliza.
   */
  packages?: Dict;

  /**
   * Informações do runtime MCP, quando disponível.
   *
   * Exemplos: MCP server instance, adapter config, transport info.
   */
  mcp?: unknown;

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
  execute(input: TInput, ctx: AgenticContext): Promise<TOutput>;
}

/* ==========================================================================
 * MCP
 * --------------------------------------------------------------------------
 * MCP exposure contract with normative fallback to tool.
 *
 * `tool` is the canonical contract for agent execution.
 * `mcp` is an optional exposure configuration for MCP publication.
 *
 * Fallback rules (normative — adapters must follow):
 * - name:        uses mcp.name if provided, otherwise falls back to tool.name
 * - description: uses mcp.description if provided, otherwise falls back to tool.description
 * - title:       uses mcp.title if provided; otherwise the adapter may derive
 *                a display title from tool.name (e.g. "user_validate" → "User Validate")
 * - inputSchema and outputSchema: always derived from tool
 * - execute:     always delegates to tool.execute()
 *
 * mcp controls presence and presentation.
 * It never redefines schemas or execution paths.
 * ========================================================================== */

export interface AgenticMcpContract {
  /**
   * Whether this Case should be exposed via MCP.
   *
   * Default: true when mcp() is defined.
   */
  enabled?: boolean;

  /**
   * MCP tool name.
   *
   * Falls back to tool().name if not provided.
   */
  name?: string;

  /**
   * MCP human-readable title.
   *
   * This is an MCP-native concept — tool does not define title.
   * If not provided, the adapter may derive a display title from tool().name.
   */
  title?: string;

  /**
   * MCP tool description.
   *
   * Falls back to tool().description if not provided.
   */
  description?: string;

  /**
   * Additional metadata for MCP adapters.
   */
  metadata?: Dict;
}

/* ==========================================================================
 * RAG
 * --------------------------------------------------------------------------
 * O contrato RAG do APP opera em duas camadas:
 *
 * 1. Camada semântica — topics, hints, scope, mode
 *    Define a intenção de retrieval: sobre o quê, com qual orientação,
 *    em qual escopo, e com qual grau de dependência.
 *
 * 2. Camada de referência concreta — resources
 *    Define referências concretas a artefatos APP-native ou project-native.
 *    O APP define o endereçamento (kind + ref). O runtime define a resolução.
 *
 * O APP não define motor de RAG, mecanismo de retrieval, ranking,
 * embedding, nem pipeline de busca. Essas responsabilidades são do runtime.
 *
 * Extensibilidade:
 * Novos resource kinds (ex: "index") podem ser padronizados apenas
 * após reference implementations demonstrarem semântica estável.
 * ========================================================================== */

/**
 * Tipos de recurso de conhecimento reconhecidos pelo APP.
 *
 * Cada kind define uma categoria de artefato que o protocolo
 * consegue endereçar de forma estável:
 *
 * - "case": referência a outro Case no projeto APP.
 *   ref é um identificador relativo ao diretório cases/.
 *   Exemplo: "users/user_validate"
 *
 * - "file": referência a um arquivo do projeto.
 *   ref é um path relativo à raiz do projeto.
 *   Exemplo: "docs/validation-rules.md"
 */
export type RagResourceKind = "case" | "file";

/**
 * Referência concreta a um artefato de conhecimento.
 *
 * O APP define o endereçamento (kind + ref).
 * O runtime define como resolver e acessar o conteúdo.
 */
export interface RagResource {
  /**
   * Tipo do recurso.
   */
  kind: RagResourceKind;

  /**
   * Referência ao recurso.
   *
   * Formato por kind:
   * - "case": identificador relativo a cases/ (ex: "users/user_validate")
   * - "file": path relativo à raiz do projeto (ex: "docs/validation-rules.md")
   */
  ref: string;

  /**
   * Descrição opcional do porquê este recurso é relevante para o Case.
   */
  description?: string;
}

export interface AgenticRagContract {
  /**
   * Rótulos semânticos normalizados do domínio de conhecimento
   * relevante para este Case.
   *
   * Usados para:
   * - indexação e classificação semântica
   * - agrupamento de Cases por área de conhecimento
   * - validação por tooling (lint, catálogos)
   * - integração com runtimes que possuam catálogo de conhecimento
   *
   * Exemplo: ["validation_rules", "document_policy"]
   */
  topics?: string[];

  /**
   * Referências concretas a artefatos de conhecimento APP-native
   * ou project-native.
   *
   * APP não define retrieval resolution. O runtime é responsável
   * por resolver e acessar o conteúdo de cada resource.
   *
   * Novos resource kinds podem ser padronizados apenas após
   * reference implementations demonstrarem semântica estável.
   */
  resources?: RagResource[];

  /**
   * Orientações livres de raciocínio e preferência para o agente.
   *
   * Diferente de topics (que são indexáveis e normalizados),
   * hints são interpretativos e não estruturais.
   *
   * Exemplo: ["Prefer official compliance material",
   *           "Use tenant-approved rules first"]
   */
  hints?: string[];

  /**
   * Escopo máximo permitido para recuperação contextual.
   */
  scope?: "case-local" | "project" | "org-approved";

  /**
   * Grau de dependência do Case em relação a contexto externo.
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
  protected readonly ctx: AgenticContext;

  constructor(ctx: AgenticContext) {
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

  /**
   * Testa a surface agentic do Case.
   *
   * Recommended APP practice:
   * surfaces ideally expose test() for self-contained contract validation.
   *
   * O teste deve verificar, no mínimo:
   * - definition() retorna contrato válido (validateDefinition)
   * - discovery, context, prompt e tool são consistentes entre si
   * - tool.execute() produz resultado esperado para inputs conhecidos
   */
  public async test(): Promise<void> {}

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
    return contract !== undefined && contract.enabled !== false;
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
   * Valida consistência interna da definição agentic.
   *
   * A implementação base verifica invariantes estruturais mínimas.
   * Subclasses podem sobrescrever para validação adicional
   * (ex: prompt constraints vs tool inputSchema, examples coverage).
   *
   * Invocado por test() como primeira fase de validação.
   */
  protected validateDefinition(): void {
    const d = this.discovery();
    if (!d.name) throw new Error("validateDefinition: discovery.name is empty");
    if (!d.description) throw new Error("validateDefinition: discovery.description is empty");

    const t = this.tool();
    if (!t.name) throw new Error("validateDefinition: tool.name is empty");
    if (!t.execute) throw new Error("validateDefinition: tool.execute is missing");

    const p = this.prompt();
    if (!p.purpose) throw new Error("validateDefinition: prompt.purpose is empty");

    // MCP, if present, must have a name
    const m = this.mcp?.();
    if (m?.enabled && !m.name) {
      throw new Error("validateDefinition: mcp.enabled but mcp.name is empty");
    }
  }
}
