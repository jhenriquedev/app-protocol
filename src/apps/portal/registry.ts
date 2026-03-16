/* ========================================================================== *
 * Portal App — Registry (Unified)
 * --------------------------------------------------------------------------
 * Registro único do app com três slots canônicos:
 *
 * - _cases:     surfaces de UI que este portal carrega
 * - _providers: adapter de HTTP (packages/http-axios → AppHttpClient de core/)
 * - _packages:  design system + date utils expostos via ctx.packages
 *
 * Mesma interface do backend. Implementações diferentes.
 * ========================================================================== */

import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";
import { AppHttpClient } from "../../core/shared/app_infra_contracts";

// ── Cases ──────────────────────────────────────────────────────────────────
import { UserValidateUi } from "../../cases/users/user_validate/user_validate.ui.case";
import { UserRegisterUi } from "../../cases/users/user_register/user_register.ui.case";

// ── Packages (bibliotecas puras, protocol-agnostic) ────────────────────────
import { DesignSystem } from "../../packages/design-system/index";
import { DateUtils } from "../../packages/date-utils/format";

/* --------------------------------------------------------------------------
 * Adapter — privado ao registry
 * --------------------------------------------------------------------------
 * Portal usa fetch nativo (sem package externo).
 * O adapter conecta fetch ao contrato AppHttpClient de core/.
 * ------------------------------------------------------------------------ */

class FetchHttpAdapter implements AppHttpClient {
  constructor(private baseURL: string) {}

  async request(config: unknown): Promise<unknown> {
    const { method, url, body } = config as {
      method: string;
      url: string;
      body?: unknown;
    };

    const response = await fetch(`${this.baseURL}${url}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    const result = (await response.json()) as { data: unknown };
    return result.data;
  }
}

/* --------------------------------------------------------------------------
 * Config do app
 * ------------------------------------------------------------------------ */

export interface PortalConfig {
  apiBaseURL: string;
}

/* --------------------------------------------------------------------------
 * Registry
 * ------------------------------------------------------------------------ */

export function createRegistry(config: PortalConfig) {
  return {
    _cases: {
      users: {
        user_validate: { ui: UserValidateUi },
        user_register: { ui: UserRegisterUi },
      },
    } satisfies Record<string, Record<string, AppCaseSurfaces>>,

    _providers: {
      httpClient: new FetchHttpAdapter(config.apiBaseURL) as AppHttpClient,
    },

    _packages: {
      designSystem: DesignSystem,
      dateUtils: DateUtils,
    },
  } as const;
}

/* --------------------------------------------------------------------------
 * Tipos derivados
 * ------------------------------------------------------------------------ */

export type PortalRegistry = ReturnType<typeof createRegistry>;
export type PortalCases    = PortalRegistry["_cases"];
export type PortalPackages = PortalRegistry["_packages"];
