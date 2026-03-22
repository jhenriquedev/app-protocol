/* ========================================================================== *
 * APP v1.1.3
 * core/web.case.ts
 * ----------------------------------------------------------------------------
 * Contrato base da surface de Web no APP.
 *
 * Representa a surface visual especializada para runtimes web.
 *
 * Responsabilidade:
 * - apresentar interface ao usuário em runtimes web
 * - gerenciar estado local via viewmodel
 * - acessar dados via repository
 * - executar lógica de negócio local via service
 *
 * Gramática canônica:
 *   view <-> _viewmodel <-> _service <-> _repository
 *
 * A surface de Web compartilha a gramática visual do APP, mas possui
 * contrato próprio. Ela não depende do contrato concreto de `ui.case.ts`.
 * O protocolo congela a semântica visual; o contrato técnico permanece
 * livre para a plataforma.
 * ========================================================================== */

import { Dict } from "./domain.case";
import { AppBaseContext } from "./shared/app_base_context";
import { AppHttpClient } from "./shared/app_infra_contracts";

export interface WebContext extends AppBaseContext {
  renderer?: unknown;
  router?: unknown;
  store?: unknown;
  browser?: unknown;
  api?: AppHttpClient;
  packages?: Dict;
  extra?: Dict;
}

export type WebState = Record<string, unknown>;

export abstract class BaseWebCase<TState extends WebState = WebState> {
  protected readonly ctx: WebContext;

  protected state: TState;

  constructor(ctx: WebContext, initialState: TState = {} as TState) {
    this.ctx = ctx;
    this.state = initialState;
  }

  public abstract view(): unknown;

  public async test(): Promise<void> {}

  protected _viewmodel?(...args: unknown[]): unknown;

  protected _service?(...args: unknown[]): unknown;

  protected _repository?(...args: unknown[]): unknown;

  protected setState(partial: Partial<TState>) {
    this.state = {
      ...this.state,
      ...partial,
    };
  }
}
