/* ========================================================================== *
 * Backend App — Registry
 * --------------------------------------------------------------------------
 * Imports only API and Stream surfaces.
 * The backend never loads UI or Agentic surfaces.
 *
 * This registry feeds:
 * - app.ts bootstrap (route mounting, event subscriptions)
 * - ctx.cases for cross-case composition
 * ========================================================================== */

import { AppCaseSurfaces, InferCasesMap } from "../../core/shared/app_host_contracts";

// Cases — only the surfaces this app needs
import { UserValidateApi } from "../../cases/users/user_validate/user_validate.api.case";
import { UserRegisterApi } from "../../cases/users/user_register/user_register.api.case";
import { UserRegisterStream } from "../../cases/users/user_register/user_register.stream.case";

/* --------------------------------------------------------------------------
 * Registry
 * --------------------------------------------------------------------------
 * Usa `satisfies` em vez de `: AppRegistry` para preservar a estrutura
 * literal de tipos. Isso permite que InferCasesMap derive o mapa de
 * instâncias com autocomplete completo.
 * ------------------------------------------------------------------------ */

export const registry = {
  users: {
    user_validate: { api: UserValidateApi },
    user_register: { api: UserRegisterApi, stream: UserRegisterStream },
  },
} satisfies Record<string, Record<string, AppCaseSurfaces>>;

/**
 * Mapa tipado de instâncias para este app.
 *
 * Uso em _composition: `const cases = this.ctx.cases as BackendCasesMap`
 */
export type BackendCasesMap = InferCasesMap<typeof registry>;
