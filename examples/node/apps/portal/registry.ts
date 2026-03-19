import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";
import { type AppHttpClient } from "../../core/shared/app_infra_contracts";
import { DesignSystem } from "../../packages/design_system/index";
import { TaskCreateUi } from "../../cases/tasks/task_create/task_create.ui.case";
import { TaskListUi } from "../../cases/tasks/task_list/task_list.ui.case";
import { TaskMoveUi } from "../../cases/tasks/task_move/task_move.ui.case";

class FetchHttpAdapter implements AppHttpClient {
  constructor(private readonly baseURL: string) {}

  async request(config: unknown): Promise<unknown> {
    const { method, url, body } = config as {
      method: string;
      url: string;
      body?: unknown;
    };

    const response = await fetch(new URL(url, this.baseURL), {
      method,
      headers: {
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      let message = `HTTP ${response.status} while requesting ${url}`;

      try {
        const errorBody = (await response.json()) as {
          error?: { message?: string };
          message?: string;
        };
        message = errorBody.error?.message ?? errorBody.message ?? message;
      } catch {
        // Ignore parse failures and keep the fallback message.
      }

      throw new Error(message);
    }

    if (response.status === 204) {
      return undefined;
    }

    const payload = (await response.json()) as {
      success?: boolean;
      data?: unknown;
      error?: { message?: string };
    };

    if (typeof payload.success === "boolean") {
      if (!payload.success) {
        throw new Error(payload.error?.message ?? "Request failed");
      }

      return payload.data;
    }

    return payload;
  }
}

export interface PortalConfig {
  apiBaseURL: string;
  port?: number;
}

export function createRegistry(config: PortalConfig) {
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
      port: config.port ?? 5173,
      httpClient: new FetchHttpAdapter(config.apiBaseURL) as AppHttpClient,
    },

    _packages: {
      designSystem: DesignSystem,
    },
  } as const;
}

export type PortalRegistry = ReturnType<typeof createRegistry>;
export type PortalCases = PortalRegistry["_cases"];
export type PortalProviders = PortalRegistry["_providers"];
export type PortalPackages = PortalRegistry["_packages"];
