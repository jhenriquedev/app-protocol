/* ========================================================================== *
 * Lambdas App — Registry
 * --------------------------------------------------------------------------
 * Registry organizado por feature (domínio).
 * Cada feature vira uma lambda — contendo todos os Cases daquele domínio.
 *
 * Exemplo:
 *   feature "users" → 1 lambda com user_validate + user_register
 *
 * O registry importa apenas surfaces de API e Stream (backend).
 * Cada lambda resolve internamente qual Case executar via rota ou evento.
 * ========================================================================== */

import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";

// Feature: users
import { UserValidateApi } from "../../cases/users/user_validate/user_validate.api.case";
import { UserRegisterApi } from "../../cases/users/user_register/user_register.api.case";
import { UserRegisterStream } from "../../cases/users/user_register/user_register.stream.case";

/* --------------------------------------------------------------------------
 * Registry
 * --------------------------------------------------------------------------
 * Shape: domain → case → surface → constructor
 *
 * Cada chave de primeiro nível (ex: users) corresponde a uma lambda.
 * A lambda recebe todas as rotas/eventos daquele domínio.
 *
 * Usa `satisfies` para preservar tipos literais (InferCasesMap).
 * ------------------------------------------------------------------------ */

export const registry = {
  users: {
    user_validate: { api: UserValidateApi },
    user_register: { api: UserRegisterApi, stream: UserRegisterStream },
  },
} satisfies Record<string, Record<string, AppCaseSurfaces>>;


/* --------------------------------------------------------------------------
 * Feature helpers
 * --------------------------------------------------------------------------
 * Extrai subsets do registry por feature.
 * Cada lambda importa apenas sua feature.
 * ------------------------------------------------------------------------ */

export function getFeature(featureName: string) {
  return (registry as Record<string, Record<string, AppCaseSurfaces>>)[featureName] ?? {};
}

export function getFeatureNames(): string[] {
  return Object.keys(registry);
}
