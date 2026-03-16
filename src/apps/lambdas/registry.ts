/* ========================================================================== *
 * Lambdas App — Registry
 * --------------------------------------------------------------------------
 * Registry organizado por feature (domínio).
 * Cada feature vira uma lambda — contendo todos os Cases daquele domínio.
 *
 * Exemplo:
 *   feature "users" → 1 lambda com user_validate + user_register
 *   feature "billing" → 1 lambda com invoice_pay + balance_check
 *
 * O registry importa apenas surfaces de API e Stream (backend).
 * Cada lambda resolve internamente qual Case executar via rota ou evento.
 * ========================================================================== */

import { AppRegistry } from "../../core/shared/app_host_contracts";

// Feature: users
import { UserValidateApi } from "../../cases/users/user_validate/user_validate.api.case";
import { UserRegisterApi } from "../../cases/users/user_register/user_register.api.case";
import { UserRegisterStream } from "../../cases/users/user_register/user_register.stream.case";

// Feature: billing (example — files not created yet)
// import { InvoicePayApi } from "../../cases/billing/invoice_pay/invoice_pay.api.case";
// import { BalanceCheckApi } from "../../cases/billing/balance_check/balance_check.api.case";

/* --------------------------------------------------------------------------
 * Registry
 * --------------------------------------------------------------------------
 * Shape: domain → case → surface → constructor
 *
 * Cada chave de primeiro nível (users, billing) corresponde a uma lambda.
 * A lambda recebe todas as rotas/eventos daquele domínio.
 * ------------------------------------------------------------------------ */

export const registry: AppRegistry = {
  users: {
    user_validate: { api: UserValidateApi },
    user_register: { api: UserRegisterApi, stream: UserRegisterStream },
  },
  // billing: {
  //   invoice_pay: { api: InvoicePayApi },
  //   balance_check: { api: BalanceCheckApi },
  // },
};

/* --------------------------------------------------------------------------
 * Feature helpers
 * --------------------------------------------------------------------------
 * Extrai subsets do registry por feature.
 * Cada lambda importa apenas sua feature.
 * ------------------------------------------------------------------------ */

export function getFeature(featureName: string) {
  return registry[featureName] ?? {};
}

export function getFeatureNames(): string[] {
  return Object.keys(registry);
}
