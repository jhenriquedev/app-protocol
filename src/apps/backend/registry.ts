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

import { AppRegistry } from "../../core/shared/app_host_contracts";

// Cases — only the surfaces this app needs
import { UserValidateApi } from "../../cases/users/user_validate/user_validate.api.case";
import { UserRegisterApi } from "../../cases/users/user_register/user_register.api.case";
import { UserRegisterStream } from "../../cases/users/user_register/user_register.stream.case";

/* --------------------------------------------------------------------------
 * Registry
 * ------------------------------------------------------------------------ */

export const registry: AppRegistry = {
  users: {
    user_validate: { api: UserValidateApi },
    user_register: { api: UserRegisterApi, stream: UserRegisterStream },
  },
};
