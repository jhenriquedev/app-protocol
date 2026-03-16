/* ========================================================================== *
 * Chatbot App — Registry
 * --------------------------------------------------------------------------
 * Imports only Agentic surfaces.
 * The chatbot never loads API, Stream, or UI surfaces directly —
 * agentic surfaces resolve to canonical API execution via ctx.cases.
 *
 * This registry feeds:
 * - app.ts bootstrap (MCP tool registration, agent discovery)
 * - ctx.cases for agentic tool execution (resolves to API surfaces)
 * ========================================================================== */

import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";

// Cases — only agentic surfaces
import { UserValidateAgentic } from "../../cases/users/user_validate/user_validate.agentic.case";
import { UserRegisterAgentic } from "../../cases/users/user_register/user_register.agentic.case";

/* --------------------------------------------------------------------------
 * Registry
 * --------------------------------------------------------------------------
 * Usa `satisfies` para preservar tipos literais (InferCasesMap).
 * ------------------------------------------------------------------------ */

export const registry = {
  users: {
    user_validate: { agentic: UserValidateAgentic },
    user_register: { agentic: UserRegisterAgentic },
  },
} satisfies Record<string, Record<string, AppCaseSurfaces>>;
