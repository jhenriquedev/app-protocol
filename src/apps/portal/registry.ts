/* ========================================================================== *
 * Portal App — Registry
 * --------------------------------------------------------------------------
 * Imports only UI surfaces.
 * The portal never loads API, Stream, or Agentic surfaces.
 * ========================================================================== */

import { AppRegistry } from "../../core/shared/app_host_contracts";

// Cases — only UI surfaces
import { UserValidateUi } from "../../cases/users/user_validate/user_validate.ui.case";
import { UserRegisterUi } from "../../cases/users/user_register/user_register.ui.case";

/* --------------------------------------------------------------------------
 * Registry
 * ------------------------------------------------------------------------ */

export const registry: AppRegistry = {
  users: {
    user_validate: { ui: UserValidateUi },
    user_register: { ui: UserRegisterUi },
  },
};
