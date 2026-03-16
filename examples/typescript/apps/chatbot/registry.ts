/* ========================================================================== *
 * Chatbot App — Registry
 * --------------------------------------------------------------------------
 * Imports only Agentic surfaces.
 * ========================================================================== */

import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";

import { TaskCreateAgentic } from "../../cases/tasks/task_create/task_create.agentic.case";
import { TaskCompleteAgentic } from "../../cases/tasks/task_complete/task_complete.agentic.case";
import { TaskListAgentic } from "../../cases/tasks/task_list/task_list.agentic.case";
import { NotificationSendAgentic } from "../../cases/notifications/notification_send/notification_send.agentic.case";

export const registry = {
  tasks: {
    task_create: { agentic: TaskCreateAgentic },
    task_complete: { agentic: TaskCompleteAgentic },
    task_list: { agentic: TaskListAgentic },
  },
  notifications: {
    notification_send: { agentic: NotificationSendAgentic },
  },
} satisfies Record<string, Record<string, AppCaseSurfaces>>;
