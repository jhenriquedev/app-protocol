/* ========================================================================== *
 * Portal App — Registry
 * --------------------------------------------------------------------------
 * Imports only UI surfaces.
 * The portal never loads API, Stream, or Agentic surfaces.
 * ========================================================================== */

import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";

// Cases — only UI surfaces
import { UserValidateUi } from "../../cases/users/user_validate/user_validate.ui.case";
import { UserRegisterUi } from "../../cases/users/user_register/user_register.ui.case";

/* --------------------------------------------------------------------------
 * Registry
 * --------------------------------------------------------------------------
 * Usa `satisfies` em vez de `: AppRegistry` para preservar a estrutura
 * literal de tipos. Isso permite que InferCasesMap derive o mapa de
 * instâncias com autocomplete completo.
 * ------------------------------------------------------------------------ */

export const registry = {
  users: {
    user_validate: { ui: UserValidateUi },
    user_register: { ui: UserRegisterUi },
  },
} satisfies Record<string, Record<string, AppCaseSurfaces>>;
