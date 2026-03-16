/* ========================================================================== *
 * APP v0.0.3
 * core/api.case.ts
 * ----------------------------------------------------------------------------
 * Contrato base da surface de API no APP.
 *
 * Responsabilidade:
 * - expor uma capacidade via interface de backend (HTTP, RPC, CLI, etc)
 * - orquestrar validação, autorização e execução
 * - retornar uma resposta estruturada
 *
 * Regra fundamental:
 * - lógica de domínio pertence ao domain.case.ts
 * - persistência ou integração deve ser encapsulada em métodos privados
 *
 * Contexto:
 * - ApiContext estende AppBaseContext com infraestrutura de backend
 * - cada projeto define os tipos concretos de http, db, auth, etc.
 * ========================================================================== */

import { Dict } from "./domain.case";
import { AppBaseContext } from "./shared/app_base_context";
import { AppHttpClient, AppStorageClient, AppCache } from "./shared/app_infra_contracts";
import { AppCaseError, AppResult } from "./shared/app_structural_contracts";

/* ==========================================================================
 * ApiContext
 * --------------------------------------------------------------------------
 * Contexto específico da surface de API.
 *
 * Estende AppBaseContext com infraestrutura de backend:
 * - httpClient: outbound HTTP client (fetch, axios, etc.)
 * - db: acesso a banco de dados (unknown — sem contrato estável)
 * - auth: autenticação e autorização (unknown — semântica de domínio)
 * - storage: persistent storage client
 * - cache: cache com TTL
 *
 * Campos com contrato mínimo usam interfaces de app_infra_contracts.ts.
 * Campos sem semântica estável permanecem unknown.
 * ========================================================================== */

export interface ApiContext extends AppBaseContext {
  /**
   * Outbound HTTP client.
   *
   * Exemplos: fetch wrapper, Axios instance, got, ky, undici.
   * Nota: este é um client contract, não um server/framework contract.
   */
  httpClient?: AppHttpClient;

  /**
   * Acesso a banco de dados.
   *
   * Mantido como unknown — paradigmas incompatíveis (ORM, query builder,
   * document store) impedem contrato mínimo convergente.
   *
   * Exemplos: Prisma client, Drizzle, Knex, connection pool.
   */
  db?: unknown;

  /**
   * Informações de autenticação e autorização.
   *
   * Mantido como unknown — carrega semântica de domínio que varia
   * entre modelos (RBAC, ABAC, claims, scopes, sessions).
   *
   * Exemplos: JWT decoded, session object, API key metadata.
   */
  auth?: unknown;

  /**
   * Persistent storage client.
   *
   * Exemplos: S3 client, GCS client, local filesystem adapter.
   */
  storage?: AppStorageClient;

  /**
   * Cache com TTL opcional.
   *
   * Exemplos: Redis client, in-memory cache, Memcached.
   */
  cache?: AppCache;

  /**
   * Registro de Cases carregados pelo runtime.
   *
   * Permite composição cross-case via registry boundary.
   * Usado por `_composition` para resolver capabilities de outros Cases.
   *
   * Exemplo: ctx.cases?.users?.user_validate?.api?.handler(input)
   */
  cases?: Dict;

  /**
   * Espaço de extensão livre para o host do projeto.
   */
  extra?: Dict;
}

/* ==========================================================================
 * ApiResponse
 * --------------------------------------------------------------------------
 * Extends AppResult with API-specific metadata.
 *
 * ApiResponse inherits the canonical result shape (success, data, error)
 * and adds optional HTTP-specific fields. Surfaces that don't need
 * API-specific metadata can use AppResult directly.
 * ========================================================================== */

/**
 * Estrutura de resposta da surface de API.
 *
 * Estende AppResult com metadados opcionais específicos de API.
 */
export interface ApiResponse<T = unknown> extends AppResult<T> {
  /**
   * HTTP status code hint.
   *
   * The runtime/adapter may use this to set the HTTP response status.
   * APP does not mandate HTTP — this is a convenience for HTTP-based hosts.
   */
  statusCode?: number;
}

/* ==========================================================================
 * BaseApiCase
 * ========================================================================== */

/**
 * Classe base para surfaces de API.
 */
export abstract class BaseApiCase<TInput = unknown, TOutput = unknown> {
  protected readonly ctx: ApiContext;

  constructor(ctx: ApiContext) {
    this.ctx = ctx;
  }

  /* =======================================================================
   * Métodos obrigatórios
   * ===================================================================== */

  /**
   * Handler principal da capacidade.
   *
   * handler é o entrypoint público da capability. Recebe input de negócio
   * e retorna resultado de negócio. NÃO é um endpoint HTTP.
   *
   * Bindings de transporte (HTTP routes, gRPC definitions, CLI commands)
   * vivem em router() ou no adapter/host.
   *
   * Deve:
   * - validar input
   * - verificar autorização
   * - executar lógica principal
   * - retornar resposta estruturada
   */
  public abstract handler(input: TInput): Promise<ApiResponse<TOutput>>;

  /**
   * Router opcional — bindings de transporte.
   *
   * É onde o Case declara sua superfície de transporte (HTTP, gRPC, CLI).
   * O router delega para handler(), nunca contém lógica de negócio.
   * O host/adapter monta as rotas coletando os router() de cada Case.
   *
   * Retorno é framework-specific (unknown).
   */
  public router?(): unknown;

  /**
   * Teste interno da capacidade.
   *
   * Obrigatório no APP — toda surface que implementa um contrato base
   * deve fornecer um método test().
   *
   * Assinatura canônica: test(): Promise<void>
   * O teste invoca handler() internamente e faz assertions.
   * Não recebe input nem retorna resultado — é validação interna.
   */
  public abstract test(): Promise<void>;

  /* =======================================================================
   * Hooks protegidos (opcionais)
   * ===================================================================== */

  /**
   * Validação de input antes da execução.
   */
  protected async _validate?(input: TInput): Promise<void>;

  /**
   * Verificação de autorização.
   */
  protected async _authorize?(input: TInput): Promise<void>;

  /**
   * Acesso a persistência e integrations locais do Case.
   *
   * Slot canônico para queries, mutations, cache reads e chamadas
   * a serviços externos de infraestrutura.
   *
   * Regra: _repository não realiza composição cross-case.
   */
  protected _repository?(): unknown;

  /**
   * Execução da lógica principal (Case atômico).
   *
   * Slot canônico para lógica de negócio que não envolve
   * orquestração cross-case. Mutuamente exclusivo com _composition
   * como centro de execução principal.
   *
   * Cases atômicos implementam _service.
   * Cases compostos implementam _composition.
   * O pipeline exige que ao menos um dos dois esteja definido.
   */
  protected async _service?(input: TInput): Promise<TOutput>;

  /**
   * Orquestração cross-case via registry (Case composto).
   *
   * Slot canônico para Cases que precisam invocar outros Cases.
   * Resolve capabilities via ctx.cases, nunca por import direto.
   *
   * Mutuamente exclusivo com _service como centro de execução principal.
   * Quando presente, o pipeline deve usar _composition em vez de _service.
   */
  protected async _composition?(input: TInput): Promise<TOutput>;

  /**
   * Método utilitário padrão para execução.
   *
   * Orquestra o pipeline: validate → authorize → (composition | service).
   *
   * Se _composition estiver definido, ele é o centro de execução (Case composto).
   * Caso contrário, _service é usado (Case atômico).
   */
  protected async execute(input: TInput): Promise<ApiResponse<TOutput>> {
    try {
      if (this._validate) await this._validate(input);
      if (this._authorize) await this._authorize(input);

      if (!this._composition && !this._service) {
        throw new AppCaseError(
          "INTERNAL",
          "BaseApiCase: at least one of _service or _composition must be implemented"
        );
      }

      const result = this._composition
        ? await this._composition(input)
        : await this._service!(input);

      return {
        success: true,
        data: result,
      };
    } catch (err) {
      if (err instanceof AppCaseError) {
        return {
          success: false,
          error: err.toAppError(),
        };
      }
      // Unexpected errors re-throw — the host/adapter decides how to handle them.
      throw err;
    }
  }
}
