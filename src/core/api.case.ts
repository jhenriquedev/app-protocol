/* ========================================================================== *
 * APP v0.0.2
 * Base contract for api.case.ts
 *
 * Esta classe define o contrato de execução síncrona de um Case.
 *
 * Responsabilidade:
 * - expor uma capacidade via interface de backend (HTTP, RPC, CLI, etc)
 * - orquestrar validação, autorização e execução
 * - retornar uma resposta estruturada
 *
 * Regra fundamental:
 * - lógica de domínio pertence ao domain.case.ts
 * - persistência ou integração deve ser encapsulada em métodos privados
 * ========================================================================== */

import { AppContext } from "./agentic.case";

/**
 * Estrutura genérica de resposta.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Classe base para surfaces de API.
 */
export abstract class BaseApiCase<TInput = unknown, TOutput = unknown> {
  protected readonly ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  /* =======================================================================
   * Métodos obrigatórios
   * ===================================================================== */

  /**
   * Handler principal da capacidade.
   *
   * Deve:
   * - validar input
   * - verificar autorização
   * - executar lógica principal
   * - retornar resposta estruturada
   */
  public abstract handler(input: TInput): Promise<ApiResponse<TOutput>>;

  /**
   * Router opcional.
   *
   * Pode registrar endpoints HTTP ou outros bindings.
   */
  public router?(): unknown;

  /**
   * Teste interno da capacidade.
   */
  public abstract test(input: TInput): Promise<ApiResponse<TOutput>>;

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
   * Execução da lógica principal.
   */
  protected abstract _service(input: TInput): Promise<TOutput>;

  /**
   * Transformação da saída para resposta final.
   */
  protected async _present?(output: TOutput): Promise<ApiResponse<TOutput>>;

  /**
   * Método utilitário padrão para execução.
   */
  protected async execute(input: TInput): Promise<ApiResponse<TOutput>> {
    if (this._validate) await this._validate(input);
    if (this._authorize) await this._authorize(input);

    const result = await this._service(input);

    if (this._present) {
      return this._present(result);
    }

    return {
      success: true,
      data: result,
    };
  }
}
