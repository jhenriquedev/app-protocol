/* ========================================================================== *
 * Example: task_complete — Stream Surface
 * --------------------------------------------------------------------------
 * Composed Case — uses _composition, not _service.
 * Reacts to "task.completed" events and notifies via cross-domain composition.
 * Pipeline: _composition delegates to notification_send via ctx.cases.
 * ========================================================================== */

import {
  BaseStreamCase,
  StreamContext,
  StreamEvent,
  AppStreamRecoveryPolicy,
} from "../../../core/stream.case";
import { ApiResponse } from "../../../core/api.case";
import { TaskCompleteOutput } from "./task_complete.domain.case";
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

export class TaskCompleteStream extends BaseStreamCase<
  TaskCompleteOutput,
  void
> {
  constructor(ctx: StreamContext) {
    super(ctx);
  }

  public async handler(
    event: StreamEvent<TaskCompleteOutput>
  ): Promise<void> {
    await this.pipeline(event);
  }

  public subscribe(): unknown {
    return {
      topic: "task.completed",
      handler: (event: StreamEvent<TaskCompleteOutput>) =>
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
      },
      deadLetter: {
        destination: "tasks.task_complete.stream.dlq",
        includeFailureMetadata: true,
      },
    };
  }

  public async test(): Promise<void> {
    const sub = this.subscribe() as { topic?: string } | undefined;
    if (!sub?.topic) throw new Error("test: subscribe() must return a topic");
    if (sub.topic !== "task.completed") throw new Error("test: topic must be 'task.completed'");

    const event: StreamEvent<TaskCompleteOutput> = {
      type: "task.completed",
      payload: {
        task: {
          id: "test-id",
          title: "Test Task",
          status: "done",
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
    event: StreamEvent<TaskCompleteOutput>
  ): Promise<TaskCompleteOutput> {
    this.ctx.logger.info("Consuming task.completed event", {
      taskId: event.payload.task.id,
      correlationId: this.ctx.correlationId,
    });

    return event.payload;
  }

  protected async _composition(
    event: StreamEvent<TaskCompleteOutput>
  ): Promise<void> {
    const consumed = this._consume
      ? await this._consume(event)
      : event.payload;

    const cases = this.ctx.cases as ExpectedCasesMap | undefined;
    const notificationApi = cases?.notifications?.notification_send?.api;

    if (notificationApi) {
      await notificationApi.handler({
        message: `Task completed: "${consumed.task.title}"`,
        channel: "email",
      });

      this.ctx.logger.info("Notification sent for completed task", {
        taskId: consumed.task.id,
      });
    }
  }
}
