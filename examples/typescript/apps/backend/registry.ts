/* ========================================================================== *
 * Backend App — Registry
 * --------------------------------------------------------------------------
 * Imports only API and Stream surfaces.
 * ========================================================================== */

import { AppCaseSurfaces, InferCasesMap } from "../../core/shared/app_host_contracts";

import { TaskCreateApi } from "../../cases/tasks/task_create/task_create.api.case";
import { TaskCompleteApi } from "../../cases/tasks/task_complete/task_complete.api.case";
import { TaskListApi } from "../../cases/tasks/task_list/task_list.api.case";
import { TaskCreateStream } from "../../cases/tasks/task_create/task_create.stream.case";
import { TaskCompleteStream } from "../../cases/tasks/task_complete/task_complete.stream.case";
import { NotificationSendApi } from "../../cases/notifications/notification_send/notification_send.api.case";
import { NotificationSendStream } from "../../cases/notifications/notification_send/notification_send.stream.case";

export const registry = {
  tasks: {
    task_create: { api: TaskCreateApi, stream: TaskCreateStream },
    task_complete: { api: TaskCompleteApi, stream: TaskCompleteStream },
    task_list: { api: TaskListApi },
  },
  notifications: {
    notification_send: { api: NotificationSendApi, stream: NotificationSendStream },
  },
} satisfies Record<string, Record<string, AppCaseSurfaces>>;

export type BackendCasesMap = InferCasesMap<typeof registry>;
