/* ========================================================================== *
 * Example: notification_send — API Surface
 * --------------------------------------------------------------------------
 * Atomic Case — uses _service, not _composition.
 * Persistence via ctx.db (injected by host).
 * Used by stream composition (task_create.stream, task_complete.stream).
 * ========================================================================== */

import { ApiContext, ApiResponse, BaseApiCase } from "../../../core/api.case";
import { AppCaseError } from "../../../core/shared/app_structural_contracts";
import {
  Notification,
  NotificationSendInput,
  NotificationSendOutput,
} from "./notification_send.domain.case";

/* --------------------------------------------------------------------------
 * DB shape (provided by host via ctx.db)
 * ------------------------------------------------------------------------ */

interface NotificationDb {
  notifications: Notification[];
}

/* --------------------------------------------------------------------------
 * API Case
 * ------------------------------------------------------------------------ */

export class NotificationSendApi extends BaseApiCase<
  NotificationSendInput,
  NotificationSendOutput
> {
  constructor(ctx: ApiContext) {
    super(ctx);
  }

  public async handler(
    input: NotificationSendInput
  ): Promise<ApiResponse<NotificationSendOutput>> {
    return this.execute(input);
  }

  public router(): unknown {
    return {
      method: "POST",
      path: "/notifications",
      handler: (req: { body: NotificationSendInput }) => this.handler(req.body),
    };
  }

  public async test(): Promise<void> {
    if (!this._service) {
      throw new Error("test: _service must be implemented (atomic Case)");
    }

    await this._validate!({ message: "Test", channel: "email" });

    let threw = false;
    try { await this._validate!({ message: "", channel: "" }); } catch { threw = true; }
    if (!threw) throw new Error("test: _validate should reject empty fields");

    const result = await this.handler({ message: "Test notification", channel: "email" });
    if (!result.success) throw new Error("test: handler returned failure");
    if (!result.data?.notification.id) throw new Error("test: notification must have id");
  }

  protected async _validate(input: NotificationSendInput): Promise<void> {
    const errors: string[] = [];
    if (!input.message) errors.push("message is required");
    if (!input.channel) errors.push("channel is required");
    if (errors.length > 0) {
      throw new AppCaseError("VALIDATION_FAILED", errors.join("; "), { errors });
    }
  }

  protected async _service(
    input: NotificationSendInput
  ): Promise<NotificationSendOutput> {
    const db = this.ctx.db as NotificationDb | undefined;
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

    const notification: Notification = {
      id,
      message: input.message,
      channel: input.channel,
      sentAt: new Date().toISOString(),
    };

    db?.notifications.push(notification);

    this.ctx.logger.info("Notification sent", {
      notificationId: id,
      channel: input.channel,
    });

    return { notification };
  }
}
