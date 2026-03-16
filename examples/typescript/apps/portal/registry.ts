/* ========================================================================== *
 * Portal App — Registry (Unified)
 * --------------------------------------------------------------------------
 * Registro único do app com três slots canônicos:
 *
 * - _cases:     surfaces de UI carregadas pelo portal
 * - _providers: adapter de HTTP montado pelo host
 * - _packages:  design system + date utils expostos via ctx.packages
 * ========================================================================== */

import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";
import { AppHttpClient } from "../../core/shared/app_infra_contracts";

import { TaskCreateUi } from "../../cases/tasks/task_create/task_create.ui.case";
import { TaskCompleteUi } from "../../cases/tasks/task_complete/task_complete.ui.case";
import { TaskListUi } from "../../cases/tasks/task_list/task_list.ui.case";
import { DateUtils } from "../../packages/date-utils/format";
import { DesignSystem } from "../../packages/design-system/index";
import { FetchClient, type FetchClientConfig } from "../../packages/http-fetch/client";

class FetchHttpAdapter implements AppHttpClient {
  constructor(private readonly client: FetchClient) {}

  async request(config: unknown): Promise<unknown> {
    const { method, url, body } = config as {
      method: string;
      url: string;
      body?: unknown;
    };

    const response = await this.client.request(method, url, body);
    return response.data;
  }
}

export interface PortalConfig {
  apiBaseURL: string;
}

export function createRegistry(config: PortalConfig) {
  const clientConfig: FetchClientConfig = {
    baseURL: config.apiBaseURL,
  };

  return {
    _cases: {
      tasks: {
        task_create: { ui: TaskCreateUi },
        task_complete: { ui: TaskCompleteUi },
        task_list: { ui: TaskListUi },
      },
    } satisfies Record<string, Record<string, AppCaseSurfaces>>,

    _providers: {
      httpClient: new FetchHttpAdapter(new FetchClient(clientConfig)) as AppHttpClient,
    },

    _packages: {
      designSystem: DesignSystem,
      dateUtils: DateUtils,
    },
  } as const;
}

export type PortalRegistry = ReturnType<typeof createRegistry>;
export type PortalCases = PortalRegistry["_cases"];
export type PortalProviders = PortalRegistry["_providers"];
export type PortalPackages = PortalRegistry["_packages"];
