/* ========================================================================== *
 * Backend App — Registry (Unified)
 * --------------------------------------------------------------------------
 * Registro único do app com três slots canônicos:
 *
 * - _cases:     surfaces de API e Stream carregadas pelo backend
 * - _providers: providers de runtime montados pelo host
 * - _packages:  bibliotecas puras expostas via ctx.packages
 * ========================================================================== */

import {
  AppStreamDeadLetterBinding,
  AppStreamRuntimeCapabilities,
} from "../../core/stream.case";
import { AppCaseSurfaces, InferCasesMap } from "../../core/shared/app_host_contracts";
import { StreamFailureEnvelope } from "../../core/shared/app_structural_contracts";
import { Task } from "../../cases/tasks/task_create/task_create.domain.case";
import { Notification } from "../../cases/notifications/notification_send/notification_send.domain.case";

import { TaskCreateApi } from "../../cases/tasks/task_create/task_create.api.case";
import { TaskCompleteApi } from "../../cases/tasks/task_complete/task_complete.api.case";
import { TaskListApi } from "../../cases/tasks/task_list/task_list.api.case";
import { TaskCreateStream } from "../../cases/tasks/task_create/task_create.stream.case";
import { TaskCompleteStream } from "../../cases/tasks/task_complete/task_complete.stream.case";
import { NotificationSendApi } from "../../cases/notifications/notification_send/notification_send.api.case";
import { NotificationSendStream } from "../../cases/notifications/notification_send/notification_send.stream.case";
import { DateUtils } from "../../packages/date-utils/format";

export interface BackendDb {
  tasks: Map<string, Task>;
  notifications: Notification[];
}

function createMemoryDb(): BackendDb {
  return {
    tasks: new Map<string, Task>(),
    notifications: [] as Notification[],
  };
}

class InMemoryDeadLetterSink implements AppStreamDeadLetterBinding {
  public readonly events: StreamFailureEnvelope[] = [];

  constructor(public readonly target: string) {}

  async publish(envelope: StreamFailureEnvelope): Promise<void> {
    this.events.push(envelope);
  }
}

export function createRegistry() {
  const taskCreateDeadLetter = new InMemoryDeadLetterSink(
    "tasks-task-create-dlq"
  );
  const taskCompleteDeadLetter = new InMemoryDeadLetterSink(
    "tasks-task-complete-dlq"
  );
  const notificationSendDeadLetter = new InMemoryDeadLetterSink(
    "notifications-notification-send-dlq"
  );

  const streamRuntime: AppStreamRuntimeCapabilities = {
    maxAttemptsLimit: 5,
    supportsJitter: true,
    deadLetters: {
      "tasks.task_create.stream.dlq": taskCreateDeadLetter,
      "tasks.task_complete.stream.dlq": taskCompleteDeadLetter,
      "notifications.notification_send.stream.dlq": notificationSendDeadLetter,
    },
  };

  return {
    _cases: {
      tasks: {
        task_create: { api: TaskCreateApi, stream: TaskCreateStream },
        task_complete: { api: TaskCompleteApi, stream: TaskCompleteStream },
        task_list: { api: TaskListApi },
      },
      notifications: {
        notification_send: {
          api: NotificationSendApi,
          stream: NotificationSendStream,
        },
      },
    } satisfies Record<string, Record<string, AppCaseSurfaces>>,

    _providers: {
      db: createMemoryDb(),
      streamRuntime,
    },

    _packages: {
      dateUtils: DateUtils,
    },
  } as const;
}

export type BackendRegistry = ReturnType<typeof createRegistry>;
export type BackendCases = BackendRegistry["_cases"];
export type BackendProviders = BackendRegistry["_providers"];
export type BackendPackages = BackendRegistry["_packages"];
export type BackendCasesMap = InferCasesMap<BackendCases>;
