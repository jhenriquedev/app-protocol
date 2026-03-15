/* ========================================================================== *
 * APP v0.0.1
 * Base contract for ui.case.ts
 *
 * Representa a superfície de interface da capacidade.
 *
 * Responsabilidade:
 * - gerenciar estado local
 * - reagir a interações do usuário
 * - renderizar interface
 * - integrar com APIs
 *
 * Não depende de framework específico.
 * ========================================================================== */

import { AppContext } from "./agentic.case";

/**
 * Estrutura genérica de estado de UI.
 */
export type UIState = Record<string, unknown>;

/**
 * Classe base para surfaces de UI.
 */
export abstract class BaseUiCase<TState extends UIState = UIState> {
  protected readonly ctx: AppContext;

  protected state: TState;

  constructor(ctx: AppContext, initialState: TState) {
    this.ctx = ctx;
    this.state = initialState;
  }

  /* =======================================================================
   * Métodos obrigatórios
   * ===================================================================== */

  /**
   * Renderização principal da interface.
   *
   * Pode retornar:
   * - HTML
   * - JSX
   * - Virtual DOM
   * - outro formato suportado pelo host
   */
  public abstract render(): unknown;

  /**
   * Montagem inicial da interface.
   */
  public mount?(): Promise<void>;

  /**
   * Teste opcional.
   */
  public async test?(): Promise<void>;

  /* =======================================================================
   * Hooks internos
   * ===================================================================== */

  /**
   * Atualização de estado.
   */
  protected setState(partial: Partial<TState>) {
    this.state = {
      ...this.state,
      ...partial,
    };
  }

  /**
   * Ações do usuário.
   */
  protected _actions?(): Record<string, (...args: unknown[]) => unknown>;

  /**
   * Efeitos colaterais da interface.
   */
  protected async _effects?(): Promise<void>;

  /**
   * Queries de dados externos.
   */
  protected async _queries?(): Promise<void>;
}
