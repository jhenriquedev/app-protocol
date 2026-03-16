/* ========================================================================== *
 * Example: user_register — Stream Surface
 * --------------------------------------------------------------------------
 * Reacts to user_registered events.
 * Atomic Case — uses _service (not _composition).
 * Pipeline: _consume → _service → _publish
 * ========================================================================== */

import {
  AppStreamRecoveryPolicy,
  BaseStreamCase,
  StreamContext,
  StreamEvent,
  validateStreamRecoveryPolicy,
} from "../../../core/stream.case";
import { UserRegisterOutput } from "./user_register.domain.case";

/* --------------------------------------------------------------------------
 * Stream Case
 * ------------------------------------------------------------------------ */

export class UserRegisterStream extends BaseStreamCase<
  UserRegisterOutput,
  void
> {
  constructor(ctx: StreamContext) {
    super(ctx);
  }

  /* =======================================================================
   * Public — capability entrypoint
   * ===================================================================== */

  public async handler(
    event: StreamEvent<UserRegisterOutput>
  ): Promise<void> {
    await this.pipeline(event);
  }

  /* =======================================================================
   * Public — transport binding
   * ===================================================================== */

  public subscribe(): unknown {
    // Framework-specific — example: SQS, EventBridge, Kafka topic
    return {
      topic: "user_registered",
      handler: (event: StreamEvent<UserRegisterOutput>) =>
        this.handler(event),
    };
  }

  public recoveryPolicy(): AppStreamRecoveryPolicy {
    return {
      retry: {
        maxAttempts: 5,
        backoffMs: 1000,
        multiplier: 2,
        maxBackoffMs: 30000,
        jitter: true,
        retryableErrors: [
          "TIMEOUT",
          "SERVICE_UNAVAILABLE",
          "CONNECTION_RESET",
        ],
      },
      deadLetter: {
        destination: "users.user_register.stream.dlq",
        includeFailureMetadata: true,
      },
    };
  }

  /* =======================================================================
   * Public — test
   * ===================================================================== */

  public async test(): Promise<void> {
    // Phase 1 — Subscription shape
    const sub = this.subscribe() as { topic?: string } | undefined;
    if (!sub?.topic) throw new Error("test: subscribe() must return a topic");

    // Phase 1.5 — Recovery contract shape
    validateStreamRecoveryPolicy(
      "users/user_register/stream",
      this.recoveryPolicy()
    );

    // Phase 2 — Pipeline slots
    const event: StreamEvent<UserRegisterOutput> = {
      type: "user_registered",
      payload: {
        id: "test-id",
        email: "test@example.com",
        name: "Test User",
        createdAt: new Date().toISOString(),
      },
    };

    if (this._consume) {
      const consumed = await this._consume(event);
      if (!consumed.id) throw new Error("test: _consume should return payload with id");
    }

    // Phase 3 — Integrated execution
    await this.handler(event);
  }

  /* =======================================================================
   * Internal — canonical slots
   * ===================================================================== */

  /**
   * Consume — extracts the user data from the event.
   */
  protected async _consume(
    event: StreamEvent<UserRegisterOutput>
  ): Promise<UserRegisterOutput> {
    this.ctx.logger.info("Consuming user_registered event", {
      userId: event.payload.id,
      correlationId: this.ctx.correlationId,
    });

    return event.payload;
  }

  /**
   * Service — processes the registration event.
   * Sends welcome email, creates default settings, etc.
   */
  protected async _service(
    user: UserRegisterOutput
  ): Promise<void> {
    this.ctx.logger.info("Processing user registration", {
      userId: user.id,
      email: user.email,
    });

    // In practice: send welcome email, create default preferences, etc.
  }

  /**
   * Repository — idempotency check.
   */
  protected _repository(): unknown {
    return this.ctx.db;
  }
}
