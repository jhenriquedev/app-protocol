/* ========================================================================== *
 * APP v0.0.2
 * Base contract for stream.case.ts
 *
 * Representa execução orientada a eventos.
 *
 * Responsabilidade:
 * - consumir eventos
 * - transformar eventos
 * - produzir novos eventos ou side effects
 *
 * Usado para:
 * - filas
 * - webhooks
 * - event bus
 * - pipelines assíncronos
 * ========================================================================== */

import { AppContext } from "./agentic.case";

/**
 * Estrutura genérica de evento.
 */
export interface StreamEvent<T = unknown> {
  type: string;
  payload: T;
  metadata?: Record<string, unknown>;
}

/**
 * Classe base para execução orientada a eventos.
 */
export abstract class BaseStreamCase<TInput = unknown, TOutput = unknown> {
  protected readonly ctx: AppContext;

  constructor(ctx: AppContext) {
    this.ctx = ctx;
  }

  /* =======================================================================
   * Métodos obrigatórios
   * ===================================================================== */

  /**
   * Handler principal do evento.
   */
  public abstract handler(event: StreamEvent<TInput>): Promise<void>;

  /**
   * Registro de subscription.
   */
  public subscribe?(): unknown;

  /**
   * Teste interno da capacidade.
   */
  public abstract test(event: StreamEvent<TInput>): Promise<void>;

  /* =======================================================================
   * Hooks internos
   * ===================================================================== */

  /**
   * Consumo inicial do evento.
   */
  protected async _consume?(event: StreamEvent<TInput>): Promise<TInput>;

  /**
   * Transformação do evento.
   */
  protected async _transform?(input: TInput): Promise<TOutput>;

  /**
   * Publicação de evento resultante.
   */
  protected async _publish?(output: TOutput): Promise<void>;

  /**
   * Política de retry.
   */
  protected async _retry?(event: StreamEvent<TInput>, error: Error): Promise<void>;

  /**
   * Pipeline padrão de execução.
   */
  protected async pipeline(event: StreamEvent<TInput>): Promise<void> {
    try {
      const consumed = this._consume
        ? await this._consume(event)
        : event.payload;

      const transformed = this._transform
        ? await this._transform(consumed)
        : (consumed as unknown as TOutput);

      if (this._publish) {
        await this._publish(transformed);
      }
    } catch (err) {
      if (this._retry) {
        await this._retry(event, err as Error);
      } else {
        throw err;
      }
    }
  }
}
