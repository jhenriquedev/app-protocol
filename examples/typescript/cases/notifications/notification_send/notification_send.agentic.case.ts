/* ========================================================================== *
 * Example: notification_send — Agentic Surface
 * --------------------------------------------------------------------------
 * Exposes notification sending to agents. Execution resolves to the
 * canonical API surface via ctx.cases.
 * ========================================================================== */

import {
  AgenticContext,
  AgenticDiscovery,
  AgenticExecutionContext,
  AgenticMcpContract,
  AgenticPolicy,
  AgenticPrompt,
  AgenticRagContract,
  AgenticToolContract,
  BaseAgenticCase,
} from "../../../core/agentic.case";
import { ApiResponse } from "../../../core/api.case";
import {
  NotificationSendDomain,
  NotificationSendInput,
  NotificationSendOutput,
} from "./notification_send.domain.case";

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

export class NotificationSendAgentic extends BaseAgenticCase<
  NotificationSendInput,
  NotificationSendOutput
> {
  protected domain(): NotificationSendDomain {
    return new NotificationSendDomain();
  }

  public discovery(): AgenticDiscovery {
    return {
      name: this.domainCaseName() ?? "notification_send",
      description: this.domainDescription() ?? "Send a notification.",
      category: "notifications",
      tags: ["notifications", "messaging", "alerts"],
      capabilities: ["notification_delivery"],
      intents: ["send a notification", "notify user", "send alert"],
    };
  }

  public context(): AgenticExecutionContext {
    return {
      requiresAuth: false,
      dependencies: ["notification_send.domain", "notification_send.api"],
      constraints: ["Message and channel are both required."],
    };
  }

  public prompt(): AgenticPrompt {
    return {
      purpose: "Send a notification through a specified channel (email, sms, push).",
      whenToUse: ["When a notification needs to be sent to a user."],
      whenNotToUse: ["When only logging an event without user notification."],
      expectedOutcome: "A notification object with id, message, channel, and sentAt.",
    };
  }

  public tool(): AgenticToolContract<NotificationSendInput, NotificationSendOutput> {
    const inputSchema = this.domainInputSchema();
    const outputSchema = this.domainOutputSchema();
    if (!inputSchema || !outputSchema) {
      throw new Error("notification_send agentic requires domain schemas");
    }

    return {
      name: "notification_send",
      description: "Send a notification through the canonical API flow.",
      inputSchema,
      outputSchema,
      isMutating: true,
      execute: async (input, ctx) => {
        const cases = ctx.cases as ExpectedCasesMap | undefined;
        const result =
          await cases?.notifications?.notification_send?.api?.handler(input);
        if (!result?.success || !result.data) {
          throw new Error(
            result?.error?.message ?? "notification_send API failed"
          );
        }
        return result.data;
      },
    };
  }

  public mcp(): AgenticMcpContract {
    return {
      enabled: true,
      name: "notification_send",
      title: "Send Notification",
      metadata: { category: "notifications", mutating: true },
    };
  }

  public rag(): AgenticRagContract {
    return {
      topics: ["notifications", "messaging"],
      resources: [
        {
          kind: "case",
          ref: "notifications/notification_send",
          description: "Notification delivery capability.",
        },
      ],
      scope: "project",
      mode: "optional",
    };
  }

  public policy(): AgenticPolicy {
    return {
      requireConfirmation: false,
      riskLevel: "low",
      executionMode: "direct-execution",
    };
  }

  public async test(): Promise<void> {
    this.validateDefinition();

    const def = this.definition();
    if (def.discovery.name !== "notification_send") {
      throw new Error("Agentic discovery name mismatch");
    }
  }
}
