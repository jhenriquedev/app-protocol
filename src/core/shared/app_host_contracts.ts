/* ========================================================================== *
 * APP v0.0.4
 * core/shared/app_host_contracts.ts
 * ----------------------------------------------------------------------------
 * Contratos de registry do APP.
 *
 * Definem a interface mínima para:
 * - AppCaseSurfaces: as surfaces disponíveis de um Case dentro de um registry
 * - AppRegistry: o catálogo de Cases e surfaces que um app carrega
 * - InferCasesMap: utility type para tipagem de ctx.cases
 *
 * Cada app em apps/ usa estes contratos:
 * - registry.ts exporta um registry (usando `satisfies` para preservar tipos)
 * - app.ts consome o registry para montar o runtime
 *
 * O protocolo define a forma, não o conteúdo:
 * - quais Cases e surfaces carregar é decisão de cada app
 * - como montar o runtime (monolito, lambda, edge) é decisão do projeto
 * - o framework (Hono, Express, React, etc.) é decisão do projeto
 * ========================================================================== */

import { Dict } from "../domain.case";
import { ApiContext } from "../api.case";
import { UiContext } from "../ui.case";
import { StreamContext } from "../stream.case";
import { AgenticContext } from "../agentic.case";

/* ==========================================================================
 * AppCaseSurfaces
 * --------------------------------------------------------------------------
 * Descreve as surfaces disponíveis de um Case dentro de um registry.
 *
 * Cada chave é uma surface canônica e o valor é o construtor da classe.
 * Apenas as surfaces que o app precisa são registradas.
 *
 * Cada surface é tipada com seu context específico (ApiContext, UiContext,
 * etc.), não com AppBaseContext genérico. Isso elimina a necessidade de
 * casts nos hosts ao instanciar Cases a partir do registry.
 *
 * Exemplo:
 *   { api: UserValidateApi }                    — só backend
 *   { ui: UserValidateUi }                      — só frontend
 *   { api: UserRegisterApi, stream: UserRegisterStream }  — backend + stream
 * ========================================================================== */

export interface AppCaseSurfaces {
  domain?: new (...args: unknown[]) => unknown;
  api?: new (ctx: ApiContext, ...args: unknown[]) => unknown;
  ui?: new (ctx: UiContext, ...args: unknown[]) => unknown;
  stream?: new (ctx: StreamContext, ...args: unknown[]) => unknown;
  agentic?: new (ctx: AgenticContext, ...args: unknown[]) => unknown;
}

/* ==========================================================================
 * AppRegistry
 * --------------------------------------------------------------------------
 * Interface unificada de registro de um app.
 *
 * Três slots canônicos:
 *
 * - _cases:     Cases ativos neste app (domínio → case → surfaces).
 *               Cada entry é um construtor de surface importado de cases/.
 *
 * - _providers: Adapters de infraestrutura (packages/ → contratos de core/).
 *               Cada entry satisfaz um contrato de core/shared/app_infra_contracts.
 *               Adapters são classes privadas ao registry — não exportadas.
 *
 * - _packages:  Bibliotecas puras compartilhadas de packages/.
 *               Expostas aos Cases via ctx.packages.
 *
 * Nenhum slot é obrigatório. App sem packages não declara _packages.
 *
 * Uso:
 *   export function createRegistry(config) {
 *     return { _cases: {...}, _providers: {...}, _packages: {...} } as const;
 *   }
 *   export type MyAppRegistry = ReturnType<typeof createRegistry>;
 *
 * O registry unifica num único arquivo tudo que o app precisa registrar.
 * ========================================================================== */

export interface AppRegistry {
  /**
   * Cases ativos neste app.
   * Shape: domínio → case → surfaces (construtores).
   */
  _cases: Dict<Dict<AppCaseSurfaces>>;

  /**
   * Providers de infraestrutura.
   * Adapters que conectam packages/ protocol-agnostic aos contratos de core/.
   * Cada entry satisfaz um contrato de core/shared/ (AppCache, AppHttpClient, etc).
   */
  _providers?: Dict;

  /**
   * Packages de biblioteca.
   * Código compartilhado puro (Money, DateUtils, DesignSystem).
   * Expostos aos Cases via ctx.packages.
   */
  _packages?: Dict;
}

/* ==========================================================================
 * InferCasesMap
 * --------------------------------------------------------------------------
 * Utility type que deriva o mapa de instâncias a partir de um registry.
 *
 * Converte construtores em seus tipos de instância, preservando a
 * estrutura literal de chaves (domínio → case → surface → instância).
 *
 * Uso:
 *   const registry = { ... } satisfies Record<string, Record<string, AppCaseSurfaces>>;
 *   type MyCasesMap = InferCasesMap<typeof registry>;
 *
 * Dentro de _composition:
 *   const cases = this.ctx.cases as MyCasesMap | undefined;
 *   // autocomplete: cases?.users?.user_validate?.api?.handler(...)
 *
 * Importante:
 * - o registry NÃO deve ser anotado como `: AppRegistry` — isso apaga
 *   a estrutura literal. Use `satisfies` para validar sem perder tipos.
 * - ctx.cases permanece Dict nos contratos base (sem generic cascade).
 * - o cast é seguro porque é derivado mecanicamente do registry real.
 * ========================================================================== */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any[] necessário
// para match contravariant de construtores com parâmetros tipados (ApiContext, etc.)
type InferSurfaceInstances<S extends AppCaseSurfaces> = {
  [K in keyof S]: S[K] extends new (...args: any[]) => infer I ? I : never;
};

export type InferCasesMap<
  R extends Record<string, Record<string, AppCaseSurfaces>>
> = {
  [Domain in keyof R]: {
    [CaseName in keyof R[Domain]]: InferSurfaceInstances<R[Domain][CaseName]>;
  };
};
