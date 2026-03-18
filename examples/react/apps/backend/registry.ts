import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";
import { createDataPackage, createJsonFileStore } from "../../packages/data/index";
import { TaskCreateApi } from "../../cases/tasks/task_create/task_create.api.case";
import { TaskListApi } from "../../cases/tasks/task_list/task_list.api.case";
import { TaskMoveApi } from "../../cases/tasks/task_move/task_move.api.case";

export interface BackendConfig {
  port?: number;
  dataDirectory?: string;
}

export function createRegistry(config: BackendConfig = {}) {
  const data = createDataPackage(config.dataDirectory);
  const taskStore = createJsonFileStore<unknown[]>({
    filePath: data.defaultFiles.tasks,
    fallbackData: [],
  });

  return {
    _cases: {
      tasks: {
        task_create: {
          api: TaskCreateApi,
        },
        task_list: {
          api: TaskListApi,
        },
        task_move: {
          api: TaskMoveApi,
        },
      },
    } satisfies Record<string, Record<string, AppCaseSurfaces>>,

    _providers: {
      port: config.port ?? 3000,
      taskStore,
    },

    _packages: {
      data,
    },
  } as const;
}

export type BackendRegistry = ReturnType<typeof createRegistry>;
export type BackendCases = BackendRegistry["_cases"];
export type BackendProviders = BackendRegistry["_providers"];
export type BackendPackages = BackendRegistry["_packages"];
