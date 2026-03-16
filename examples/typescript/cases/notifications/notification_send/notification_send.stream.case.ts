/* ========================================================================== *
 * Example: notification_send — Stream Surface
 * --------------------------------------------------------------------------
 * Atomic Case — uses _service, not _composition.
 * Reacts to "notification.requested" events and logs delivery.
 * Pipeline: _consume → _service
 * ========================================================================== */

import {
  BaseStreamCase,
  StreamContext,
  StreamEvent,
} from "../../../core/stream.case";
import {
  Notification,
  NotificationSendInput,
} from "./notification_send.domain.case";

/* --------------------------------------------------------------------------
 * DB shape (provided by host via ctx.db)
 * ------------------------------------------------------------------------ */

interface NotificationDb {
  notifications: Notification[];
}

/* --------------------------------------------------------------------------
 * Stream Case
 * ------------------------------------------------------------------------ */

export class NotificationSendStream extends BaseStreamCase<
  NotificationSendInput,
  void
> {
  constructor(ctx: StreamContext) {
    super(ctx);
  }

  public async handler(
    event: StreamEvent<NotificationSendInput>
  ): Promise<void> {
    await this.pipeline(event);
  }

  public subscribe(): unknown {
    return {
      topic: "notification.requested",
      handler: (event: StreamEvent<NotificationSendInput>) =>
        this.handler(event),
    };
  }

  public async test(): Promise<void> {
    const sub = this.subscribe() as { topic?: string } | undefined;
    if (!sub?.topic) throw new Error("test: subscribe() must return a topic");

    const event: StreamEvent<NotificationSendInput> = {
      type: "notification.requested",
      payload: { message: "Test notification", channel: "email" },
    };

    if (this._consume) {
      const consumed = await this._consume(event);
      if (!consumed.message) throw new Error("test: _consume should return payload");
    }

    await this.handler(event);
  }

  protected async _consume(
    event: StreamEvent<NotificationSendInput>
  ): Promise<NotificationSendInput> {
    this.ctx.logger.info("Consuming notification.requested event", {
      channel: event.payload.channel,
      correlationId: this.ctx.correlationId,
    });

    return event.payload;
  }

  protected async _service(
    input: NotificationSendInput
  ): Promise<void> {
    const db = this.ctx.db as NotificationDb | undefined;
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

    const notification: Notification = {
      id,
      message: input.message,
      channel: input.channel,
      sentAt: new Date().toISOString(),
    };

    db?.notifications.push(notification);

    this.ctx.logger.info("Notification delivered via stream", {
      notificationId: id,
      channel: input.channel,
    });
  }

  protected async _retry(
    event: StreamEvent<NotificationSendInput>,
    error: Error
  ): Promise<void> {
    this.ctx.logger.error("Failed to deliver notification", {
      channel: event.payload.channel,
      error: error.message,
    });
  }
}
