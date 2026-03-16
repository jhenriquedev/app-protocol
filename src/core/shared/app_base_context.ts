/* ========================================================================== *
 * APP v0.0.4
 * core/shared/app_base_context.ts
 * ----------------------------------------------------------------------------
 * Contexto base compartilhado do APP.
 *
 * Este contrato define o mínimo que qualquer surface pode precisar:
 * identidade da execução, identidade do usuário e observabilidade.
 *
 * Cada surface estende este contexto com suas necessidades específicas:
 * - ApiContext   → http, db, auth
 * - UiContext    → framework renderer, client router, store
 * - StreamContext → eventBus, queue adapters, recovery metadata
 * - AgenticContext → cases registry, MCP runtime
 *
 * O domain.case.ts não recebe contexto — ele é puro por definição.
 *
 * Decisões de design:
 *
 * 1. correlationId é a identidade da operação completa.
 *    Uma request que entra pela API, dispara um evento no stream,
 *    aciona um agente que chama outro Case — tudo carrega o mesmo
 *    correlationId. Equivale ao traceId no OpenTelemetry.
 *    Se não fornecido pelo caller, deve ser gerado automaticamente.
 *
 * 2. executionId é a identidade de cada etapa dentro da operação.
 *    Quando a API valida input, isso é uma execução. Quando o stream
 *    consome o evento resultante, é outra execução. Todos compartilham
 *    o mesmo correlationId, mas cada um tem seu próprio executionId.
 *    É opcional — nem toda execução precisa de granularidade de etapa.
 *
 * 3. Apenas informações cross-cutting vivem aqui.
 *    Infraestrutura específica (http, db, eventBus, renderer)
 *    pertence ao contexto de cada surface.
 * ========================================================================== */

import { Dict } from "../domain.case";

/* ==========================================================================
 * Logger contract
 * --------------------------------------------------------------------------
 * Contrato mínimo de observabilidade.
 *
 * Todo logger no APP deve implementar esta interface.
 * Implementações concretas podem estender com níveis adicionais,
 * structured logging, ou integração com plataformas de observabilidade.
 *
 * O meta aceita Dict para permitir campos contextuais como:
 * - correlationId (injetado automaticamente pelo runtime)
 * - executionId
 * - caseName
 * - surface
 * ========================================================================== */

export interface AppLogger {
  debug(message: string, meta?: Dict): void;
  info(message: string, meta?: Dict): void;
  warn(message: string, meta?: Dict): void;
  error(message: string, meta?: Dict): void;
}

/* ==========================================================================
 * AppBaseContext
 * --------------------------------------------------------------------------
 * Contexto base compartilhado por todas as surfaces que recebem contexto.
 *
 * Este contrato é intencionalmente enxuto.
 * Ele carrega apenas o que é genuinamente transversal:
 * - rastreabilidade (correlationId, executionId)
 * - identidade (tenantId, userId)
 * - observabilidade (logger)
 * - configuração (config)
 *
 * Tudo que é específico de infraestrutura pertence ao contexto
 * da surface correspondente (ApiContext, UiContext, etc.).
 * ========================================================================== */

export interface AppBaseContext {
  /**
   * Identidade da operação completa.
   *
   * Todas as surfaces, Cases e boundaries que participam da mesma
   * operação devem compartilhar o mesmo correlationId.
   *
   * Equivalente ao traceId no OpenTelemetry.
   *
   * Se não fornecido pelo caller, o runtime deve gerar automaticamente
   * (UUID v4 ou formato equivalente).
   */
  correlationId: string;

  /**
   * Identidade da etapa atual dentro da operação.
   *
   * Cada surface ou passo de execução pode gerar seu próprio executionId
   * para permitir rastreio granular dentro de uma mesma operação.
   *
   * Opcional — nem toda execução precisa de granularidade de etapa.
   */
  executionId?: string;

  /**
   * Identificador do tenant.
   *
   * Opcional — nem todo sistema é multi-tenant.
   */
  tenantId?: string;

  /**
   * Identificador do usuário autenticado.
   *
   * Opcional — nem toda operação exige autenticação.
   */
  userId?: string;

  /**
   * Logger canônico do APP.
   *
   * Obrigatório — toda surface que recebe contexto deve ter
   * acesso a observabilidade.
   *
   * Implementações são incentivadas a injetar correlationId
   * e executionId automaticamente em cada entrada de log.
   */
  logger: AppLogger;

  /**
   * Configuração do host.
   *
   * Espaço livre para o projeto injetar configurações
   * de runtime, feature flags, ou parâmetros de ambiente.
   */
  config?: Dict;
}
