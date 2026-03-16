/* ========================================================================== *
 * Chatbot App — Registry (Unified)
 * --------------------------------------------------------------------------
 * O chatbot registra surfaces agentic para discovery e surfaces API para
 * execução canônica das tools via ctx.cases.
 * ========================================================================== */

import { AppCaseSurfaces, InferCasesMap } from "../../core/shared/app_host_contracts";
import { Task } from "../../cases/tasks/task_create/task_create.domain.case";
import { Notification } from "../../cases/notifications/notification_send/notification_send.domain.case";

import { TaskCreateApi } from "../../cases/tasks/task_create/task_create.api.case";
import { TaskCreateAgentic } from "../../cases/tasks/task_create/task_create.agentic.case";
import { TaskCompleteApi } from "../../cases/tasks/task_complete/task_complete.api.case";
import { TaskCompleteAgentic } from "../../cases/tasks/task_complete/task_complete.agentic.case";
import { TaskListApi } from "../../cases/tasks/task_list/task_list.api.case";
import { TaskListAgentic } from "../../cases/tasks/task_list/task_list.agentic.case";
import { NotificationSendApi } from "../../cases/notifications/notification_send/notification_send.api.case";
import { NotificationSendAgentic } from "../../cases/notifications/notification_send/notification_send.agentic.case";
import { DateUtils } from "../../packages/date-utils/format";

export interface ChatbotDb {
  tasks: Map<string, Task>;
  notifications: Notification[];
}

function createMemoryDb(): ChatbotDb {
  return {
    tasks: new Map<string, Task>(),
    notifications: [] as Notification[],
  };
}

export function createRegistry() {
  return {
    _cases: {
      tasks: {
        task_create: { api: TaskCreateApi, agentic: TaskCreateAgentic },
        task_complete: { api: TaskCompleteApi, agentic: TaskCompleteAgentic },
        task_list: { api: TaskListApi, agentic: TaskListAgentic },
      },
      notifications: {
        notification_send: {
          api: NotificationSendApi,
          agentic: NotificationSendAgentic,
        },
      },
    } satisfies Record<string, Record<string, AppCaseSurfaces>>,

    _providers: {
      db: createMemoryDb(),
    },

    _packages: {
      dateUtils: DateUtils,
    },
  } as const;
}

export type ChatbotRegistry = ReturnType<typeof createRegistry>;
export type ChatbotCases = ChatbotRegistry["_cases"];
export type ChatbotProviders = ChatbotRegistry["_providers"];
export type ChatbotPackages = ChatbotRegistry["_packages"];
export type ChatbotCasesMap = InferCasesMap<ChatbotCases>;
