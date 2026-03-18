/* ========================================================================== *
 * APP v0.0.9
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
import { StreamFailureEnvelope } from "./shared/app_structural_contracts";
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
   * Exemplo: ctx.cases?.users?.user_validate?.api?.handler(input)
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

  /**
   * Chave de idempotência do evento.
   *
   * Permite que consumers detectem e descartem eventos duplicados.
   * Essencial para produção com brokers que garantem at-least-once
   * delivery (SQS, Kafka, RabbitMQ, EventBridge).
   *
   * O protocolo não dita o formato — pode ser UUID, hash do payload,
   * ou chave de negócio composta. A responsabilidade de gerar e
   * verificar a chave é do producer e do consumer respectivamente.
   */
  idempotencyKey?: string;

  metadata?: Record<string, unknown>;
}

/* ==========================================================================
 * AppStreamRecoveryPolicy
 * --------------------------------------------------------------------------
 * Declarative recovery contract for stream capabilities.
 *
 * This policy describes intended semantics only.
 * The app host is responsible for validating compatibility with the
 * chosen runtime and for translating the contract to platform-specific
 * configuration.
 * ========================================================================== */

export interface AppStreamRecoveryPolicy {
  retry?: {
    /**
     * Total number of attempts, including the first execution.
     *
     * maxAttempts: 1 = fail-fast, no retry.
     */
    maxAttempts: number;
    backoffMs?: number;
    multiplier?: number;
    maxBackoffMs?: number;
    jitter?: boolean;
    retryableErrors?: string[];
  };

  deadLetter?: {
    /**
     * Logical dead-letter destination identifier.
     *
     * Must be bound by the app host to a physical transport destination.
     */
    destination: string;
    includeFailureMetadata?: boolean;
  };
}

export interface AppStreamDeadLetterBinding<TEvent = unknown> {
  publish(envelope: StreamFailureEnvelope<StreamEvent<TEvent>>): Promise<void>;
}

export interface AppStreamRuntimeCapabilities {
  maxAttemptsLimit?: number;
  supportsJitter?: boolean;
  deadLetters?: Dict<AppStreamDeadLetterBinding>;
}

/* ==========================================================================
 * Policy validation
 * --------------------------------------------------------------------------
 * Protocol-level shape validation for recovery metadata.
 *
 * This validates the canonical APP invariants that are independent of any
 * specific runtime. Host-specific compatibility checks (DLQ bindings,
 * jitter support, attempt limits, etc.) remain the app's responsibility.
 * ========================================================================== */

export function validateStreamRecoveryPolicy(
  source: string,
  policy?: AppStreamRecoveryPolicy
): void {
  if (!policy) return;

  const label = source || "stream";
  const retry = policy.retry;
  const deadLetter = policy.deadLetter;

  if (retry) {
    if (!Number.isInteger(retry.maxAttempts) || retry.maxAttempts < 1) {
      throw new Error(
        `${label}: recoveryPolicy.retry.maxAttempts must be an integer >= 1`
      );
    }

    if (retry.backoffMs !== undefined && retry.backoffMs < 0) {
      throw new Error(`${label}: recoveryPolicy.retry.backoffMs must be >= 0`);
    }

    if (retry.multiplier !== undefined && retry.multiplier < 1) {
      throw new Error(`${label}: recoveryPolicy.retry.multiplier must be >= 1`);
    }

    if (retry.maxBackoffMs !== undefined && retry.maxBackoffMs < 0) {
      throw new Error(`${label}: recoveryPolicy.retry.maxBackoffMs must be >= 0`);
    }

    if (
      retry.backoffMs !== undefined &&
      retry.maxBackoffMs !== undefined &&
      retry.maxBackoffMs < retry.backoffMs
    ) {
      throw new Error(
        `${label}: recoveryPolicy.retry.maxBackoffMs must be >= backoffMs`
      );
    }

    if (
      retry.retryableErrors?.some((code) => code.trim().length === 0)
    ) {
      throw new Error(
        `${label}: recoveryPolicy.retry.retryableErrors must contain stable non-empty codes`
      );
    }
  }

  if (deadLetter && deadLetter.destination.trim().length === 0) {
    throw new Error(
      `${label}: recoveryPolicy.deadLetter.destination must be a non-empty logical identifier`
    );
  }
}

export function validateStreamRuntimeCompatibility(
  source: string,
  policy: AppStreamRecoveryPolicy | undefined,
  runtime: AppStreamRuntimeCapabilities
): void {
  if (!policy) return;

  const label = source || "stream";
  const retry = policy.retry;
  const deadLetter = policy.deadLetter;

  if (
    retry?.maxAttempts !== undefined &&
    runtime.maxAttemptsLimit !== undefined &&
    retry.maxAttempts > runtime.maxAttemptsLimit
  ) {
    throw new Error(
      `${label}: recoveryPolicy.retry.maxAttempts=${retry.maxAttempts} exceeds host limit ${runtime.maxAttemptsLimit}`
    );
  }

  if (retry?.jitter && runtime.supportsJitter === false) {
    throw new Error(
      `${label}: recoveryPolicy.retry.jitter=true but host runtime does not support jitter`
    );
  }

  if (
    deadLetter &&
    !runtime.deadLetters?.[deadLetter.destination]
  ) {
    throw new Error(
      `${label}: dead-letter destination "${deadLetter.destination}" is not bound by the host app`
    );
  }
}

export function isStreamErrorRetryable(
  error: unknown,
  retryableErrors?: string[]
): boolean {
  if (!retryableErrors || retryableErrors.length === 0) {
    return true;
  }

  const code = extractStreamErrorCode(error);
  return code ? retryableErrors.includes(code) : false;
}

export function computeStreamRetryDelayMs(
  retry: NonNullable<AppStreamRecoveryPolicy["retry"]>,
  attempt: number
): number {
  const base = retry.backoffMs ?? 0;
  if (base <= 0) return 0;

  const multiplier = retry.multiplier ?? 1;
  const exponent = Math.max(0, attempt - 1);
  let delay = base * Math.pow(multiplier, exponent);

  if (retry.maxBackoffMs !== undefined) {
    delay = Math.min(delay, retry.maxBackoffMs);
  }

  if (retry.jitter && delay > 0) {
    delay = Math.floor(Math.random() * delay);
  }

  return Math.floor(delay);
}

export function createStreamFailureEnvelope<TEvent>(
  caseName: string,
  event: StreamEvent<TEvent>,
  error: unknown,
  attempts: number,
  correlationId: string,
  firstAttemptAt: string,
  lastAttemptAt: string
): StreamFailureEnvelope<StreamEvent<TEvent>> {
  const code = extractStreamErrorCode(error);
  const message =
    error instanceof Error ? error.message : "Unknown stream failure";
  const stack = error instanceof Error ? error.stack : undefined;

  return {
    caseName,
    surface: "stream",
    originalEvent: event,
    lastError: {
      message,
      ...(code !== undefined && { code }),
      ...(stack !== undefined && { stack }),
    },
    attempts,
    firstAttemptAt,
    lastAttemptAt,
    correlationId,
  };
}

function extractStreamErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return undefined;
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
   * Declaração contratual de recovery.
   *
   * O retorno deve ser metadata pura:
   * - determinística
   * - serializável
   * - sem callbacks
   * - independente do payload do evento
   *
   * O app host valida e traduz essa policy para o runtime real.
   */
  public recoveryPolicy?(): AppStreamRecoveryPolicy;

  /**
   * Teste interno da capacidade.
   *
   * Boa prática recomendada no APP — surfaces idealmente expõem um
   * método test() para validação autocontida do contrato.
   *
   * Assinatura canônica: test(): Promise<void>
   * O teste cria eventos internamente e invoca handler()/pipeline().
   * Não recebe input — é validação interna.
   */
  public async test(): Promise<void> {}

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
   * Pipeline padrão de execução.
   *
   * Se _composition estiver definido, delega para ele (Case composto).
   * Caso contrário, orquestra o fluxo atômico: consume → service → publish.
   *
   * O pipeline default não implementa retry, backoff nem dead-letter.
   * Recovery é responsabilidade do app host/runtime quando recoveryPolicy()
   * estiver declarada.
   */
  protected async pipeline(event: StreamEvent<TInput>): Promise<void> {
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
  }
}
