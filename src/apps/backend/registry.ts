/* ========================================================================== *
 * Backend App — Registry (Unified)
 * --------------------------------------------------------------------------
 * Registro único do app com três slots canônicos:
 *
 * - _cases:     surfaces de API e Stream que este backend carrega
 * - _providers: adapters de infraestrutura (packages/ → contratos de core/)
 * - _packages:  bibliotecas puras de packages/ expostas via ctx.packages
 *
 * Um arquivo. Três responsabilidades. Zero ambiguidade.
 *
 * Regras enforçáveis:
 * - _cases       → só imports de cases/
 * - _providers   → imports de packages/ (wrappers) + core/ (contratos)
 * - _packages    → só imports de packages/ (bibliotecas puras)
 * - Adapters     → classes privadas, não exportadas
 * ========================================================================== */

import {
  AppStreamDeadLetterBinding,
  AppStreamRuntimeCapabilities,
} from "../../core/stream.case";
import { AppCaseSurfaces, InferCasesMap } from "../../core/shared/app_host_contracts";
import { AppCache, AppHttpClient } from "../../core/shared/app_infra_contracts";
import { StreamFailureEnvelope } from "../../core/shared/app_structural_contracts";

// ── Cases ──────────────────────────────────────────────────────────────────
import { UserValidateApi } from "../../cases/users/user_validate/user_validate.api.case";
import { UserRegisterApi } from "../../cases/users/user_register/user_register.api.case";
import { UserRegisterStream } from "../../cases/users/user_register/user_register.stream.case";

// ── Packages (bibliotecas puras, protocol-agnostic) ────────────────────────
import { Money } from "../../packages/money/money";
import { DateUtils } from "../../packages/date-utils/format";

// ── Packages (wrappers de infra, protocol-agnostic) ────────────────────────
import { RedisClient, type RedisConfig } from "../../packages/cache-redis/client";
import { AxiosClient, type AxiosClientConfig } from "../../packages/http-axios/client";

/* --------------------------------------------------------------------------
 * Adapters — privados ao registry
 * --------------------------------------------------------------------------
 * Ponte entre packages/ protocol-agnostic e contratos de core/.
 *
 * Estas classes:
 * - NÃO são exportadas
 * - NÃO são reutilizadas entre apps
 * - implementam contratos de core/ usando wrappers de packages/
 * - vivem aqui porque o registry é o composition root do app
 * ------------------------------------------------------------------------ */

class RedisCacheAdapter implements AppCache {
  constructor(private redis: RedisClient) {}

  async get(key: string): Promise<unknown> {
    return this.redis.get(key);
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    return this.redis.set(key, String(value), ttl);
  }
}

class AxiosHttpAdapter implements AppHttpClient {
  constructor(private axios: AxiosClient) {}

  async request(config: unknown): Promise<unknown> {
    const { method, url, body } = config as {
      method: string;
      url: string;
      body?: unknown;
    };
    const response = await this.axios.request(method, url, body);
    return response.data;
  }
}

class InMemoryDeadLetterSink implements AppStreamDeadLetterBinding {
  public readonly events: StreamFailureEnvelope[] = [];

  constructor(public readonly target: string) {}

  async publish(envelope: StreamFailureEnvelope): Promise<void> {
    this.events.push(envelope);
  }
}

/* --------------------------------------------------------------------------
 * Config do app
 * ------------------------------------------------------------------------ */

export interface BackendConfig {
  redis: RedisConfig;
  http: AxiosClientConfig;
}

/* --------------------------------------------------------------------------
 * Registry
 * --------------------------------------------------------------------------
 * Factory function que recebe config e retorna o registry completo.
 *
 * _cases:     construtores (classes) — instanciados pelo host sob demanda
 * _providers: instâncias prontas — adapters já resolvidos com config
 * _packages:  exports puros — sem instanciação necessária
 * ------------------------------------------------------------------------ */

export function createRegistry(config: BackendConfig) {
  const userRegisterDeadLetter = new InMemoryDeadLetterSink(
    "backend-users-user-register-dlq"
  );

  const streamRuntime: AppStreamRuntimeCapabilities = {
    maxAttemptsLimit: 5,
    supportsJitter: true,
    deadLetters: {
      "users.user_register.stream.dlq": userRegisterDeadLetter,
    },
  };

  return {
    _cases: {
      users: {
        user_validate: { api: UserValidateApi },
        user_register: { api: UserRegisterApi, stream: UserRegisterStream },
      },
    } satisfies Record<string, Record<string, AppCaseSurfaces>>,

    _providers: {
      cache: new RedisCacheAdapter(
        new RedisClient(config.redis)
      ) as AppCache,

      httpClient: new AxiosHttpAdapter(
        new AxiosClient(config.http)
      ) as AppHttpClient,

      streamRuntime,
    },

    _packages: {
      money: Money,
      dateUtils: DateUtils,
    },
  } as const;
}

/* --------------------------------------------------------------------------
 * Tipos derivados do registry
 * --------------------------------------------------------------------------
 * Derivados mecanicamente — autocomplete completo em toda cadeia.
 * ------------------------------------------------------------------------ */

export type BackendRegistry  = ReturnType<typeof createRegistry>;
export type BackendCases     = BackendRegistry["_cases"];
export type BackendProviders = BackendRegistry["_providers"];
export type BackendPackages  = BackendRegistry["_packages"];

/** Mapa tipado de instâncias para _composition. */
export type BackendCasesMap = InferCasesMap<BackendCases>;
