/* ========================================================================== *
 * Chatbot App — Registry (Unified)
 * --------------------------------------------------------------------------
 * O chatbot registra surfaces agentic para discovery e surfaces API para
 * execução canônica das tools via ctx.cases.
 * ========================================================================== */

import { AppCaseSurfaces, InferCasesMap } from "../../core/shared/app_host_contracts";

// Cases — discovery + execução canônica
import { UserValidateApi } from "../../cases/users/user_validate/user_validate.api.case";
import { UserValidateAgentic } from "../../cases/users/user_validate/user_validate.agentic.case";
import { UserRegisterApi } from "../../cases/users/user_register/user_register.api.case";
import { UserRegisterAgentic } from "../../cases/users/user_register/user_register.agentic.case";

/* --------------------------------------------------------------------------
 * Registry
 * ------------------------------------------------------------------------ */

export const registry = {
  _cases: {
    users: {
      user_validate: { api: UserValidateApi, agentic: UserValidateAgentic },
      user_register: { api: UserRegisterApi, agentic: UserRegisterAgentic },
    },
  } satisfies Record<string, Record<string, AppCaseSurfaces>>,

  _providers: {},

  _packages: {},
} as const;

export type ChatbotCases = typeof registry._cases;
export type ChatbotCasesMap = InferCasesMap<ChatbotCases>;
