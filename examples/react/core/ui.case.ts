/* ========================================================================== *
 * APP v1.1.1
 * core/ui.case.ts
 * ----------------------------------------------------------------------------
 * Base contract for the APP UI surface.
 *
 * Represents the interface surface of the capability.
 *
 * Responsibility:
 * - present an interface to the user
 * - manage local state via the viewmodel
 * - access data through the repository
 * - execute local business logic through the service
 *
 * Canonical grammar:
 *   view <-> _viewmodel <-> _service <-> _repository
 *
 * The view is a live, self-contained visual unit: a form,
 * a table with filters, a sidebar, an appbar.
 *
 * The framework lifecycle (render, mount, dismount, etc.)
 * lives inside view as an implementation detail — the protocol
 * does not prescribe lifecycle hooks.
 *
 * It does not depend on a specific framework.
 *
 * Context:
 * - UiContext extends AppBaseContext with frontend infrastructure
 * - each project defines the concrete types for renderer, router, store, etc.
 * ========================================================================== */

import { Dict } from "./domain.case";
import { AppBaseContext } from "./shared/app_base_context";
import { AppHttpClient } from "./shared/app_infra_contracts";

/* ==========================================================================
 * UiContext
 * --------------------------------------------------------------------------
 * UI surface-specific context.
 *
 * Extends AppBaseContext with frontend infrastructure:
 * - renderer: rendering framework (React, Vue, Svelte, Flutter, etc.)
 * - router: client-side router
 * - store: global or shared state
 * - api: HTTP client for backend calls
 *
 * All infrastructure fields are optional and typed as unknown
 * to preserve framework neutrality.
 * ========================================================================== */

export interface UiContext extends AppBaseContext {
  /**
   * Rendering framework.
   *
   * Examples: React root, Vue app instance, Svelte component context.
   */
  renderer?: unknown;

  /**
   * Client-side router.
   *
   * Examples: React Router, Vue Router, Svelte navigate.
   */
  router?: unknown;

  /**
   * Global or shared state.
   *
   * Examples: Redux store, Zustand, Pinia, Riverpod.
   */
  store?: unknown;

  /**
   * HTTP client for backend calls.
   *
   * Examples: fetch wrapper, Axios instance, tRPC client.
   */
  api?: AppHttpClient;

  /**
   * Library packages registered by the host.
   *
   * Exposed through registry._packages.
   * Pure libraries from packages/ that the app makes available.
   */
  packages?: Dict;

  /**
   * Free extension space for the project host.
   */
  extra?: Dict;
}

/* ==========================================================================
 * UIState
 * ========================================================================== */

/**
 * Generic UI state structure.
 */
export type UIState = Record<string, unknown>;

/* ==========================================================================
 * BaseUiCase
 * --------------------------------------------------------------------------
 * Base class for UI surfaces.
 *
 * The canonical UI grammar is:
 *
 *   view <-> _viewmodel <-> _service <-> _repository
 *
 * - view(): public entrypoint — the live visual unit (form, table,
 *   sidebar, appbar, widget). The framework lifecycle (render, mount,
 *   dismount) is an internal implementation detail of the view.
 *
 * - _viewmodel(): transforms state and data into a presentation model
 *   for the view to consume.
 *
 * - _service(): local UI business logic (state behavior,
 *   client-side validations, local data transformations).
 *
 * - _repository(): data access — API calls, local storage, cache reads.
 *
 * Note about _composition:
 * ui.case.ts does not include _composition. Direct cross-case orchestration
 * from the UI is discouraged in APP.
 *
 * Note about multiple classes:
 * The pattern of separating UIPresenter + UICase inside the same ui.case.ts
 * is allowed as an optional internal structure. The protocol freezes the
 * semantic slots, not the internal class organization.
 * ========================================================================== */

/**
 * Base class for UI surfaces.
 */
export abstract class BaseUiCase<TState extends UIState = UIState> {
  protected readonly ctx: UiContext;

  protected state: TState;

  /**
   * @param ctx — UI context provided by the host
   * @param initialState — initial state of the Case.
   *   Optional in the base class: the concrete Case defines its own
   *   initial state via super(ctx, { ... }). The host never needs to know
   *   the internal state of a Case.
   */
  constructor(ctx: UiContext, initialState: TState = {} as TState) {
    this.ctx = ctx;
    this.state = initialState;
  }

  /* =======================================================================
   * Required methods
   * ===================================================================== */

  /**
   * Public entrypoint of the visual unit.
   *
   * The view is the live, self-contained visual unit of the Case.
   * Examples: registration form, table with filters, sidebar, appbar.
   *
   * It may return:
   * - HTML
   * - JSX
   * - Virtual DOM
   * - Widget tree
   * - another format supported by the host/framework
   *
   * The framework lifecycle (render, mount, dismount, etc.)
   * lives inside view as an implementation detail.
   * The protocol does not prescribe lifecycle hooks.
   */
  public abstract view(): unknown;

  /**
   * Internal capability test.
   *
   * Recommended APP practice — surfaces should ideally expose a
   * test() method for self-contained contract validation.
   */
  public async test(): Promise<void> {}

  /* =======================================================================
   * Internal canonical slots
   * ===================================================================== */

  /**
   * Viewmodel — transforms state and data into a presentation model.
   *
   * Canonical slot that separates data preparation from rendering.
   * The view consumes the viewmodel result without containing
   * state transformation logic.
   *
   * Responsibilities:
   * - combine state + external data into a presentation model
   * - derive computed fields
   * - format data for the view
   */
  protected _viewmodel?(...args: unknown[]): unknown;

  /**
   * Local UI business logic.
   *
   * Canonical slot for state behavior, client-side validations,
   * local data transformations, and user actions.
   *
   * Note: _service in the UI is local logic — it does not involve
   * cross-case composition or orchestration.
   */
  protected _service?(...args: unknown[]): unknown;

  /**
   * Access to data and local persistence.
   *
   * Canonical slot for API calls, local storage, cache reads,
   * and any data integration.
   *
   * Rule: _repository must not perform cross-case composition.
   */
  protected _repository?(...args: unknown[]): unknown;

  /* =======================================================================
   * Internal utility
   * ===================================================================== */

  /**
   * State update.
   */
  protected setState(partial: Partial<TState>) {
    this.state = {
      ...this.state,
      ...partial,
    };
  }
}
