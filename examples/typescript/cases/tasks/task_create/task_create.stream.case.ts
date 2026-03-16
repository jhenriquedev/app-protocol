/* ========================================================================== *
 * Example: task_create — Stream Surface
 * --------------------------------------------------------------------------
 * Composed Case — uses _composition, not _service.
 * Reacts to "task.created" events and notifies via cross-domain composition.
 * Pipeline: _composition delegates to notification_send via ctx.cases.
 * ========================================================================== */

import {
  BaseStreamCase,
  StreamContext,
  StreamEvent,
} from "../../../core/stream.case";
import { ApiResponse } from "../../../core/api.case";
import { TaskCreateOutput } from "./task_create.domain.case";
import {
  NotificationSendInput,
  NotificationSendOutput,
} from "../../notifications/notification_send/notification_send.domain.case";

/* --------------------------------------------------------------------------
 * Expected shape of ctx.cases for composition (local type — no import from apps)
 * ------------------------------------------------------------------------ */

type ExpectedCasesMap = {
  notifications?: {
    notification_send?: {
      api?: {
        handler(
          input: NotificationSendInput
        ): Promise<ApiResponse<NotificationSendOutput>>;
      };
    };
  };
};

/* --------------------------------------------------------------------------
 * Stream Case
 * ------------------------------------------------------------------------ */

export class TaskCreateStream extends BaseStreamCase<
  TaskCreateOutput,
  void
> {
  constructor(ctx: StreamContext) {
    super(ctx);
  }

  public async handler(
    event: StreamEvent<TaskCreateOutput>
  ): Promise<void> {
    await this.pipeline(event);
  }

  public subscribe(): unknown {
    return {
      topic: "task.created",
      handler: (event: StreamEvent<TaskCreateOutput>) =>
        this.handler(event),
    };
  }

  public async test(): Promise<void> {
    const sub = this.subscribe() as { topic?: string } | undefined;
    if (!sub?.topic) throw new Error("test: subscribe() must return a topic");
    if (sub.topic !== "task.created") throw new Error("test: topic must be 'task.created'");

    const event: StreamEvent<TaskCreateOutput> = {
      type: "task.created",
      payload: {
        task: {
          id: "test-id",
          title: "Test Task",
          status: "pending",
          createdAt: new Date().toISOString(),
        },
      },
    };

    if (this._consume) {
      const consumed = await this._consume(event);
      if (!consumed.task.id) throw new Error("test: _consume should return payload");
    }
  }

  protected async _consume(
    event: StreamEvent<TaskCreateOutput>
  ): Promise<TaskCreateOutput> {
    this.ctx.logger.info("Consuming task.created event", {
      taskId: event.payload.task.id,
      correlationId: this.ctx.correlationId,
    });

    return event.payload;
  }

  protected async _composition(
    event: StreamEvent<TaskCreateOutput>
  ): Promise<void> {
    const consumed = this._consume
      ? await this._consume(event)
      : event.payload;

    const cases = this.ctx.cases as ExpectedCasesMap | undefined;
    const notificationApi = cases?.notifications?.notification_send?.api;

    if (notificationApi) {
      await notificationApi.handler({
        message: `New task created: "${consumed.task.title}"`,
        channel: "email",
      });

      this.ctx.logger.info("Notification sent for new task", {
        taskId: consumed.task.id,
      });
    }
  }
}
