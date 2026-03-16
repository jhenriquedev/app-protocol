/* ========================================================================== *
 * APP v0.0.3
 * core/stream.case.ts
 * ----------------------------------------------------------------------------
 * Contrato base da surface de stream no APP.
 *
 * Representa execução orientada a eventos.
 *
 * Responsabilidade:
 * - consumir eventos
 * - processar lógica de negócio (service) ou orquestrar (composition)
 * - produzir novos eventos ou side effects
 *
 * Usado para:
 * - filas
 * - webhooks
 * - event bus
 * - pipelines assíncronos
 *
 * Contexto:
 * - StreamContext estende AppBaseContext com infraestrutura de eventos
 * - cada projeto define os tipos concretos de eventBus, queue, etc.
 * ========================================================================== */

import { Dict } from "./domain.case";
import { AppBaseContext } from "./shared/app_base_context";
import { AppEventPublisher, AppCache } from "./shared/app_infra_contracts";

/* ==========================================================================
 * StreamContext
 * --------------------------------------------------------------------------
 * Contexto específico da surface de stream.
 *
 * Estende AppBaseContext com infraestrutura de eventos:
 * - eventBus: event publisher (publish side only — consume is in stream surface)
 * - queue: acesso a filas (unknown — precisa de nota normativa distinguindo de eventBus)
 * - db: acesso a banco (unknown — sem contrato estável)
 * - cache: cache com TTL
 *
 * Campos com contrato mínimo usam interfaces de app_infra_contracts.ts.
 * Campos sem semântica estável permanecem unknown.
 * ========================================================================== */

export interface StreamContext extends AppBaseContext {
  /**
   * Event publisher.
   *
   * Covers the publish side of event-driven communication.
   * The consume/subscribe side is modeled by BaseStreamCase.subscribe().
   *
   * Exemplos: Kafka producer, RabbitMQ channel, Redis Pub/Sub publisher.
   */
  eventBus?: AppEventPublisher;

  /**
   * Acesso a filas.
   *
   * Mantido como unknown — próximo demais de eventBus, precisa de
   * nota normativa distinguindo antes de receber contrato mínimo.
   *
   * Exemplos: SQS client, BullMQ queue, Cloud Tasks.
   */
  queue?: unknown;

  /**
   * Acesso a banco de dados.
   *
   * Mantido como unknown — sem contrato estável.
   * Útil para: idempotência, checkpoints, estado de pipeline.
   */
  db?: unknown;

  /**
   * Cache com TTL opcional.
   *
   * Útil para: deduplicação, controle de retry, janelas de processamento.
   */
  cache?: AppCache;

  /**
   * Registro de Cases carregados pelo runtime.
   *
   * Permite composição cross-case via registry boundary.
   * Usado por `_composition` para resolver capabilities de outros Cases.
   *
   * Exemplo: ctx.cases?.billing?.balance_check?.api?.handler(input)
   */
  cases?: Dict;

  /**
   * Espaço de extensão livre para o host do projeto.
   */
  extra?: Dict;
}

/* ==========================================================================
 * StreamEvent
 * ========================================================================== */

/**
 * Estrutura genérica de evento.
 */
export interface StreamEvent<T = unknown> {
  type: string;
  payload: T;
  metadata?: Record<string, unknown>;
}

/* ==========================================================================
 * BaseStreamCase
 * ========================================================================== */

/**
 * Classe base para execução orientada a eventos.
 */
export abstract class BaseStreamCase<TInput = unknown, TOutput = unknown> {
  protected readonly ctx: StreamContext;

  constructor(ctx: StreamContext) {
    this.ctx = ctx;
  }

  /* =======================================================================
   * Métodos obrigatórios
   * ===================================================================== */

  /**
   * Handler principal do evento.
   *
   * handler é o entrypoint público da capability de stream.
   * Recebe um evento de negócio e processa.
   *
   * Bindings de transporte (topic subscriptions, queue listeners)
   * vivem em subscribe() ou no adapter/host.
   */
  public abstract handler(event: StreamEvent<TInput>): Promise<void>;

  /**
   * Registro de subscription.
   */
  public subscribe?(): unknown;

  /**
   * Teste interno da capacidade.
   *
   * Obrigatório no APP — toda surface que implementa um contrato base
   * deve fornecer um método test().
   */
  public abstract test(event: StreamEvent<TInput>): Promise<void>;

  /* =======================================================================
   * Slots canônicos internos
   * ===================================================================== */

  /**
   * Acesso a persistência e integrations locais do Case.
   *
   * Slot canônico para idempotência, checkpoints, estado de pipeline.
   *
   * Regra: _repository não realiza composição cross-case.
   */
  protected _repository?(): unknown;

  /**
   * Orquestração cross-case via registry (Case composto).
   *
   * Slot canônico para stream Cases que precisam invocar outros Cases.
   * Resolve capabilities via ctx.cases, nunca por import direto.
   *
   * Quando presente, o pipeline deve usar _composition como centro principal.
   */
  protected async _composition?(event: StreamEvent<TInput>): Promise<void>;

  /* =======================================================================
   * Hooks internos
   * ===================================================================== */

  /**
   * Consumo inicial do evento.
   */
  protected async _consume?(event: StreamEvent<TInput>): Promise<TInput>;

  /**
   * Lógica atômica de negócio da stream (Case atômico).
   *
   * Slot canônico para processamento do evento consumido.
   * Recebe input, processa, produz output.
   *
   * Mutuamente exclusivo com _composition como centro de execução principal.
   */
  protected async _service?(input: TInput): Promise<TOutput>;

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
   *
   * Se _composition estiver definido, delega para ele (Case composto).
   * Caso contrário, orquestra o fluxo atômico: consume → service → publish.
   * Em caso de erro, delega para _retry se disponível.
   */
  protected async pipeline(event: StreamEvent<TInput>): Promise<void> {
    try {
      if (this._composition) {
        await this._composition(event);
        return;
      }

      const consumed = this._consume
        ? await this._consume(event)
        : event.payload;

      const transformed = this._service
        ? await this._service(consumed)
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
