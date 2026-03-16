/* ========================================================================== *
 * Example: user_register — Stream Surface
 * --------------------------------------------------------------------------
 * Reacts to user_registered events.
 * Atomic Case — uses _service (not _composition).
 * Pipeline: _consume → _service → _publish
 * ========================================================================== */

import {
  BaseStreamCase,
  StreamContext,
  StreamEvent,
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

  /* =======================================================================
   * Public — test
   * ===================================================================== */

  public async test(): Promise<void> {
    // Phase 1 — Subscription shape
    const sub = this.subscribe() as { topic?: string } | undefined;
    if (!sub?.topic) throw new Error("test: subscribe() must return a topic");

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

  /**
   * Retry — retry policy for failed event processing.
   */
  protected async _retry(
    event: StreamEvent<UserRegisterOutput>,
    error: Error
  ): Promise<void> {
    this.ctx.logger.error("Failed to process user_registered event", {
      userId: event.payload.id,
      error: error.message,
    });

    // In practice: dead letter queue, exponential backoff, etc.
  }
}
