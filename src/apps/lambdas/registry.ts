/* ========================================================================== *
 * Lambdas App — Registry (Unified)
 * --------------------------------------------------------------------------
 * Registry organizado por feature (domínio) com os três slots canônicos:
 *
 * - _cases: surfaces de API e Stream carregadas por feature
 * - _providers: bindings de runtime do host (inclui recovery/dlq)
 * - _packages: bibliotecas compartilhadas expostas ao contexto, se houver
 * ========================================================================== */

import {
  AppStreamDeadLetterBinding,
  AppStreamRuntimeCapabilities,
} from "../../core/stream.case";
import { AppCaseSurfaces } from "../../core/shared/app_host_contracts";
import { StreamFailureEnvelope } from "../../core/shared/app_structural_contracts";

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

class InMemoryDeadLetterSink implements AppStreamDeadLetterBinding {
  public readonly events: StreamFailureEnvelope[] = [];

  constructor(public readonly target: string) {}

  async publish(envelope: StreamFailureEnvelope): Promise<void> {
    this.events.push(envelope);
  }
}

const userRegisterDeadLetter = new InMemoryDeadLetterSink(
  "lambdas-users-user-register-dlq"
);

const streamRuntime: AppStreamRuntimeCapabilities = {
  maxAttemptsLimit: 5,
  supportsJitter: true,
  deadLetters: {
    "users.user_register.stream.dlq": userRegisterDeadLetter,
  },
};

export const registry = {
  _cases: {
    users: {
      user_validate: { api: UserValidateApi },
      user_register: { api: UserRegisterApi, stream: UserRegisterStream },
    },
  } satisfies Record<string, Record<string, AppCaseSurfaces>>,

  _providers: {
    streamRuntime,
  },

  _packages: {},
} as const;


/* --------------------------------------------------------------------------
 * Feature helpers
 * --------------------------------------------------------------------------
 * Extrai subsets do registry por feature.
 * Cada lambda importa apenas sua feature.
 * ------------------------------------------------------------------------ */

export function getFeature(featureName: string) {
  return (
    registry._cases as Record<string, Record<string, AppCaseSurfaces>>
  )[featureName] ?? {};
}

export function getFeatureNames(): string[] {
  return Object.keys(registry._cases);
}
