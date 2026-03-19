import { type AppHttpClient } from "../../core/shared/app_infra_contracts";
import { type AppCaseSurfaces } from "../../core/shared/app_host_contracts";
import * as designSystem from "../../packages/design_system/index";
import { TaskCreateUi } from "../../cases/tasks/task_create/task_create.ui.case";
import { TaskListUi } from "../../cases/tasks/task_list/task_list.ui.case";
import { TaskMoveUi } from "../../cases/tasks/task_move/task_move.ui.case";

export interface PortalConfig {
  port?: number;
  backendBaseUrl?: string;
}

function createPortalHttpClient(baseUrl: string): AppHttpClient {
  return {
    async request(config: unknown): Promise<unknown> {
      const request = (config ?? {}) as {
        method?: string;
        url?: string;
        headers?: Record<string, string>;
        body?: string;
        input?: unknown;
      };

      if (!request.url) {
        throw new Error("Portal HTTP client requires a url");
      }

      const url = new URL(request.url, baseUrl);
      const response = await fetch(url, {
        method: request.method ?? "GET",
        headers: {
          "content-type": "application/json",
          ...(request.headers ?? {}),
        },
        body:
          request.body ??
          (request.input !== undefined &&
          request.method &&
          request.method !== "GET"
            ? JSON.stringify(request.input)
            : undefined),
      });

      return (await response.json()) as unknown;
    },
  };
}

export function createRegistry(config: PortalConfig = {}) {
  const backendBaseUrl = config.backendBaseUrl ?? "http://localhost:3300";

  return {
    _cases: {
      tasks: {
        task_create: {
          ui: TaskCreateUi,
        },
        task_list: {
          ui: TaskListUi,
        },
        task_move: {
          ui: TaskMoveUi,
        },
      },
    } satisfies Record<string, Record<string, AppCaseSurfaces>>,
    _providers: {
      port: config.port ?? 3310,
      backendBaseUrl,
      httpClient: createPortalHttpClient(backendBaseUrl),
    },
    _packages: {
      designSystem,
    },
  } as const;
}

export type PortalRegistry = ReturnType<typeof createRegistry>;
