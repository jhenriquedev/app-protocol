/* ========================================================================== *
 * Example: notification_send — Domain Surface
 * ========================================================================== */

import { AppSchema, BaseDomainCase, DomainExample } from "../../../core/domain.case";

/* --------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------ */

export interface Notification {
  id: string;
  message: string;
  channel: string;
  sentAt: string;
}

export interface NotificationSendInput {
  message: string;
  channel: string;
}

export interface NotificationSendOutput {
  notification: Notification;
}

/* --------------------------------------------------------------------------
 * Domain Case
 * ------------------------------------------------------------------------ */

export class NotificationSendDomain extends BaseDomainCase<
  NotificationSendInput,
  NotificationSendOutput
> {
  caseName(): string {
    return "notification_send";
  }

  description(): string {
    return "Sends a notification through a specified channel.";
  }

  inputSchema(): AppSchema {
    return {
      type: "object",
      properties: {
        message: { type: "string", description: "Notification message" },
        channel: { type: "string", description: "Delivery channel (email, sms, push)" },
      },
      required: ["message", "channel"],
    };
  }

  outputSchema(): AppSchema {
    return {
      type: "object",
      properties: {
        notification: {
          type: "object",
          properties: {
            id: { type: "string" },
            message: { type: "string" },
            channel: { type: "string" },
            sentAt: { type: "string" },
          },
          required: ["id", "message", "channel", "sentAt"],
        },
      },
      required: ["notification"],
    };
  }

  validate(input: NotificationSendInput): void {
    if (!input.message || typeof input.message !== "string") {
      throw new Error("message is required and must be a string");
    }
    if (!input.channel || typeof input.channel !== "string") {
      throw new Error("channel is required and must be a string");
    }
  }

  invariants(): string[] {
    return [
      "Message must be a non-empty string",
      "Channel must be a non-empty string",
      "sentAt is set at send time",
    ];
  }

  examples(): DomainExample<NotificationSendInput, NotificationSendOutput>[] {
    return [
      {
        name: "email_notification",
        description: "Send an email notification",
        input: { message: "Task created: Buy groceries", channel: "email" },
        output: {
          notification: {
            id: "notif-1",
            message: "Task created: Buy groceries",
            channel: "email",
            sentAt: "2026-01-01T00:00:00.000Z",
          },
        },
      },
    ];
  }

  async test(): Promise<void> {
    const def = this.definition();
    if (!def.caseName) throw new Error("test: caseName is empty");
    if (!def.inputSchema.properties) throw new Error("test: inputSchema has no properties");

    this.validate!({ message: "Test", channel: "email" });

    let threw = false;
    try { this.validate!({ message: "", channel: "" }); } catch { threw = true; }
    if (!threw) throw new Error("test: validate should reject empty fields");
  }
}
