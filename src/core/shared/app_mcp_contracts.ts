/* ========================================================================== *
 * APP v1.1.2
 * core/shared/app_mcp_contracts.ts
 * ----------------------------------------------------------------------------
 * Contratos protocolares MCP para hosts agentic do APP.
 *
 * Estes contratos definem a fronteira estrutural entre o runtime do host
 * agentic e um ou mais adapters MCP concretos. Eles permanecem deliberadamente
 * agnósticos ao transporte:
 * - o host controla catálogo, policy e execução canônica
 * - o provider controla framing, lifecycle e mecânica do transporte
 *
 * Implementações concretas de MCP pertencem a registry._providers.
 * ========================================================================== */

import type { AppSchema, Dict } from "../domain.case";

export interface AppMcpClientInfo {
  name: string;
  version: string;
}

export interface AppMcpServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
  instructions?: string;
}

export interface AppMcpInitializeParams {
  protocolVersion: string;
  capabilities?: Dict;
  clientInfo?: AppMcpClientInfo;
}

export interface AppMcpInitializeResult {
  protocolVersion: string;
  capabilities: {
    tools?: {
      listChanged?: boolean;
    };
    resources?: {
      listChanged?: boolean;
    };
  };
  serverInfo: {
    name: string;
    version: string;
  };
  instructions?: string;
}

export interface AppMcpTextContent {
  type: "text";
  text: string;
}

export interface AppMcpToolDescriptor {
  name: string;
  title?: string;
  description?: string;
  inputSchema: AppSchema;
  outputSchema?: AppSchema;
  annotations?: Dict;
}

export interface AppMcpResourceDescriptor {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: Dict;
}

export interface AppMcpTextResourceContent {
  uri: string;
  mimeType?: string;
  text: string;
}

export interface AppMcpCallResult {
  content: AppMcpTextContent[];
  structuredContent?: unknown;
  isError?: boolean;
}

export interface AppMcpReadResourceResult {
  contents: AppMcpTextResourceContent[];
}

export interface AppMcpRequestContext {
  transport: string;
  requestId?: string | number | null;
  sessionId?: string;
  correlationId?: string;
  clientInfo?: AppMcpClientInfo;
  protocolVersion?: string;
}

export interface AppMcpServer {
  serverInfo(): AppMcpServerInfo;
  initialize(
    params?: AppMcpInitializeParams,
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpInitializeResult>;
  listTools(
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpToolDescriptor[]>;
  listResources(
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpResourceDescriptor[]>;
  readResource(
    uri: string,
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpReadResourceResult>;
  callTool(
    name: string,
    args: unknown,
    parent?: Partial<AppMcpRequestContext>
  ): Promise<AppMcpCallResult>;
}

export abstract class BaseAppMcpAdapter {
  public abstract readonly transport: string;
}

export abstract class BaseAppMcpProcessAdapter extends BaseAppMcpAdapter {
  public abstract serve(server: AppMcpServer): Promise<void>;
}

export interface AppMcpHttpExchange {
  method: string;
  path: string;
  headers: Record<string, string | undefined>;
  bodyText?: string;
}

export interface AppMcpHttpResponse {
  statusCode: number;
  headers?: Record<string, string>;
  bodyText?: string;
}

export abstract class BaseAppMcpHttpAdapter extends BaseAppMcpAdapter {
  public abstract readonly endpointPath: string;
  public abstract handle(
    exchange: AppMcpHttpExchange,
    server: AppMcpServer
  ): Promise<AppMcpHttpResponse | undefined>;
}

export class AppMcpProtocolError extends Error {
  public readonly code: number;
  public readonly data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = "AppMcpProtocolError";
    this.code = code;
    this.data = data;
  }
}
