/* ========================================================================== *
 * APP v1.1.5
 * core/mobile.case.ts
 * ----------------------------------------------------------------------------
 * Contrato base da surface de Mobile no APP.
 *
 * Representa a surface visual especializada para runtimes mobile.
 *
 * Responsabilidade:
 * - apresentar interface ao usuário em runtimes mobile
 * - gerenciar estado local via viewmodel
 * - acessar dados via repository
 * - executar lógica de negócio local via service
 *
 * Gramática canônica:
 *   view <-> _viewmodel <-> _service <-> _repository
 *
 * A surface de Mobile compartilha a gramática visual do APP, mas possui
 * contrato próprio. Ela não depende do contrato concreto de `web.case.ts`.
 * O protocolo congela a semântica visual; o contrato técnico permanece
 * livre para a plataforma.
 * ========================================================================== */

import { Dict } from "./domain.case";
import { AppBaseContext } from "./shared/app_base_context";
import { AppHttpClient } from "./shared/app_infra_contracts";

export interface MobileContext extends AppBaseContext {
  renderer?: unknown;
  navigator?: unknown;
  appState?: unknown;
  device?: unknown;
  api?: AppHttpClient;
  packages?: Dict;
  extra?: Dict;
}

export type MobileState = Record<string, unknown>;

export abstract class BaseMobileCase<TState extends MobileState = MobileState> {
  protected readonly ctx: MobileContext;

  protected state: TState;

  constructor(ctx: MobileContext, initialState: TState = {} as TState) {
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
