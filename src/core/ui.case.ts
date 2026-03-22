/* ========================================================================== *
 * APP v1.1.2
 * core/ui.case.ts
 * ----------------------------------------------------------------------------
 * Contrato base da surface de UI no APP.
 *
 * Representa a surface visual generalista da capacidade.
 *
 * Responsabilidade:
 * - apresentar interface ao usuário
 * - gerenciar estado local via viewmodel
 * - acessar dados via repository
 * - executar lógica de negócio local via service
 *
 * Gramática canônica:
 *   view <-> _viewmodel <-> _service <-> _repository
 *
 * A view é uma unidade visual viva e autocontida: um formulário,
 * uma tabela com filtros, uma sidebar, uma appbar.
 *
 * O ciclo de vida de framework (render, mount, dismount, etc.)
 * vive dentro de view como detalhe de implementação — o protocolo
 * não dita lifecycle hooks.
 *
 * Não depende de framework específico.
 * `ui.case.ts` é a alternativa generalista da família visual do APP.
 * Quando um projeto precisa de contratos especializados por plataforma,
 * pode usar `web.case.ts` e/ou `mobile.case.ts` sem tornar `ui.case.ts`
 * obrigatório.
 *
 * Contexto:
 * - UiContext estende AppBaseContext com infraestrutura de frontend
 * - cada projeto define os tipos concretos de renderer, router, store, etc.
 * ========================================================================== */

import { Dict } from "./domain.case";
import { AppBaseContext } from "./shared/app_base_context";
import { AppHttpClient } from "./shared/app_infra_contracts";

/* ==========================================================================
 * UiContext
 * --------------------------------------------------------------------------
 * Contexto específico da surface de UI generalista.
 *
 * Estende AppBaseContext com infraestrutura de frontend:
 * - renderer: framework de renderização (React, Vue, Svelte, Flutter, etc.)
 * - router: roteador client-side
 * - store: estado global ou compartilhado
 * - api: cliente HTTP para chamadas ao backend
 *
 * Todos os campos de infraestrutura são opcionais e tipados como unknown
 * para manter neutralidade de framework.
 * ========================================================================== */

export interface UiContext extends AppBaseContext {
  /**
   * Framework de renderização.
   *
   * Exemplos: React root, Vue app instance, Svelte component context.
   */
  renderer?: unknown;

  /**
   * Roteador client-side.
   *
   * Exemplos: React Router, Vue Router, Svelte navigate.
   */
  router?: unknown;

  /**
   * Estado global ou compartilhado.
   *
   * Exemplos: Redux store, Zustand, Pinia, Riverpod.
   */
  store?: unknown;

  /**
   * HTTP client para chamadas ao backend.
   *
   * Exemplos: fetch wrapper, Axios instance, tRPC client.
   */
  api?: AppHttpClient;

  /**
   * Packages de biblioteca registrados pelo host.
   *
   * Expostos via registry._packages.
   * Bibliotecas puras de packages/ (ex: DesignSystem, DateUtils)
   * que o app disponibiliza para seus Cases de UI.
   */
  packages?: Dict;

  /**
   * Espaço de extensão livre para o host do projeto.
   */
  extra?: Dict;
}

/* ==========================================================================
 * UIState
 * ========================================================================== */

/**
 * Estrutura genérica de estado de UI.
 */
export type UIState = Record<string, unknown>;

/* ==========================================================================
 * BaseUiCase
 * --------------------------------------------------------------------------
 * Classe base para surfaces de UI.
 *
 * A gramática canônica da UI é:
 *
 *   view <-> _viewmodel <-> _service <-> _repository
 *
 * - view(): entrypoint público — a unidade visual viva (formulário, tabela,
 *   sidebar, appbar, widget). O ciclo de vida de framework (render, mount,
 *   dismount) é detalhe de implementação interno à view.
 *
 * - _viewmodel(): transforma estado e dados em modelo de apresentação
 *   para a view consumir.
 *
 * - _service(): lógica de negócio local da UI (comportamento de estado,
 *   validações client-side, transformações de dados locais).
 *
 * - _repository(): acesso a dados — API calls, local storage, cache reads.
 *
 * Nota sobre _composition:
 * ui.case.ts não inclui _composition. Orquestração cross-case direta
 * a partir da UI é desencorajada no APP.
 *
 * Nota sobre múltiplas classes:
 * O pattern de separar UIPresenter + UICase dentro do mesmo ui.case.ts
 * é permitido como estrutura interna opcional. O protocolo congela os
 * slots semânticos, não a organização interna de classes.
 * ========================================================================== */

/**
 * Classe base para surfaces de UI.
 */
export abstract class BaseUiCase<TState extends UIState = UIState> {
  protected readonly ctx: UiContext;

  protected state: TState;

  /**
   * @param ctx — contexto de UI fornecido pelo host
   * @param initialState — estado inicial do Case.
   *   Opcional na base: o Case concreto define seu próprio estado inicial
   *   via super(ctx, { ... }). O host nunca precisa conhecer o estado
   *   interno de um Case.
   */
  constructor(ctx: UiContext, initialState: TState = {} as TState) {
    this.ctx = ctx;
    this.state = initialState;
  }

  /* =======================================================================
   * Métodos obrigatórios
   * ===================================================================== */

  /**
   * Entrypoint público da unidade visual.
   *
   * A view é a unidade visual viva e autocontida do Case.
   * Exemplos: formulário de cadastro, tabela com filtros, sidebar, appbar.
   *
   * Pode retornar:
   * - HTML
   * - JSX
   * - Virtual DOM
   * - Widget tree
   * - outro formato suportado pelo host/framework
   *
   * O ciclo de vida de framework (render, mount, dismount, etc.)
   * vive dentro de view como detalhe de implementação.
   * O protocolo não dita lifecycle hooks.
   */
  public abstract view(): unknown;

  /**
   * Teste interno da capacidade.
   *
   * Boa prática recomendada no APP — surfaces idealmente expõem um
   * método test() para validação autocontida do contrato.
   */
  public async test(): Promise<void> {}

  /* =======================================================================
   * Slots canônicos internos
   * ===================================================================== */

  /**
   * Viewmodel — transforma estado e dados em modelo de apresentação.
   *
   * Slot canônico que separa a preparação de dados da renderização.
   * A view consome o resultado do viewmodel, sem conter lógica
   * de transformação de estado.
   *
   * Responsabilidades:
   * - combinar state + dados externos em modelo de apresentação
   * - derivar campos calculados
   * - formatar dados para a view
   */
  protected _viewmodel?(...args: unknown[]): unknown;

  /**
   * Lógica de negócio local da UI.
   *
   * Slot canônico para comportamento de estado, validações client-side,
   * transformações de dados locais, e ações do usuário.
   *
   * Nota: _service na UI é lógica local — não envolve composição
   * cross-case nem orquestração.
   */
  protected _service?(...args: unknown[]): unknown;

  /**
   * Acesso a dados e persistência local.
   *
   * Slot canônico para API calls, local storage, cache reads,
   * e qualquer integração de dados.
   *
   * Regra: _repository não realiza composição cross-case.
   */
  protected _repository?(...args: unknown[]): unknown;

  /* =======================================================================
   * Utilitário interno
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
}
