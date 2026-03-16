/* ========================================================================== *
 * APP v0.0.3
 * core/shared/app_host_contracts.ts
 * ----------------------------------------------------------------------------
 * Contratos de host e registry do APP.
 *
 * Definem a interface mínima para:
 * - AppRegistry: o catálogo de Cases e surfaces que um app carrega
 * - AppHost: o bootstrap de um app (server, lambda, frontend, etc.)
 *
 * Cada app em apps/ implementa estes contratos:
 * - registry.ts exporta um AppRegistry
 * - app.ts implementa um AppHost
 *
 * O protocolo define a forma, não o conteúdo:
 * - quais Cases e surfaces carregar é decisão de cada app
 * - como montar o runtime (monolito, lambda, edge) é decisão do projeto
 * - o framework (Hono, Express, React, etc.) é decisão do projeto
 * ========================================================================== */

import { Dict } from "../domain.case";
import { AppBaseContext } from "./app_base_context";

/* ==========================================================================
 * AppCaseSurfaces
 * --------------------------------------------------------------------------
 * Descreve as surfaces disponíveis de um Case dentro de um registry.
 *
 * Cada chave é uma surface canônica e o valor é o construtor da classe.
 * Apenas as surfaces que o app precisa são registradas.
 *
 * Exemplo:
 *   { api: UserValidateApi }                    — só backend
 *   { ui: UserValidateUi }                      — só frontend
 *   { api: UserRegisterApi, stream: UserRegisterStream }  — backend + stream
 * ========================================================================== */

export interface AppCaseSurfaces {
  domain?: new (...args: unknown[]) => unknown;
  api?: new (ctx: AppBaseContext, ...args: unknown[]) => unknown;
  ui?: new (ctx: AppBaseContext, ...args: unknown[]) => unknown;
  stream?: new (ctx: AppBaseContext, ...args: unknown[]) => unknown;
  agentic?: new (ctx: AppBaseContext, ...args: unknown[]) => unknown;
}

/* ==========================================================================
 * AppRegistry
 * --------------------------------------------------------------------------
 * Catálogo de Cases registrados por um app.
 *
 * Estrutura: domínio → case → surfaces
 *
 * Exemplo:
 *   {
 *     users: {
 *       user_validate: { api: UserValidateApi },
 *       user_register: { api: UserRegisterApi, stream: UserRegisterStream },
 *     },
 *     billing: {
 *       invoice_pay: { api: InvoicePayApi },
 *     },
 *   }
 *
 * O registry exporta construtores (classes), não instâncias.
 * O host instancia sob demanda, passando o contexto apropriado.
 * Isso é compatível com qualquer modelo de deploy.
 *
 * O mesmo shape alimenta ctx.cases para composição cross-case.
 * ========================================================================== */

export type AppRegistry = Dict<Dict<AppCaseSurfaces>>;

/* ==========================================================================
 * AppHost
 * --------------------------------------------------------------------------
 * Interface mínima para o bootstrap de um app.
 *
 * Cada app em apps/ implementa este contrato:
 * - registry(): retorna o catálogo de Cases deste app
 * - start(): inicializa o runtime (server, listeners, etc.)
 *
 * O protocolo não dita como start() funciona internamente.
 * Monolito monta um server. Lambda registra handlers. Edge exporta functions.
 *
 * O contexto factory é responsabilidade do host — não faz parte
 * desta interface porque é específico por surface e por framework.
 * ========================================================================== */

export interface AppHost {
  /**
   * Retorna o registry deste app.
   */
  registry(): AppRegistry;

  /**
   * Inicializa o runtime.
   *
   * Para um backend monolito: monta rotas e inicia o server.
   * Para um frontend: monta a app tree e renderiza.
   * Para lambda: pode ser no-op (cada function importa o registry diretamente).
   */
  start(): Promise<void>;
}
