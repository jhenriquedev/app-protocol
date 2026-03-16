/* ========================================================================== *
 * packages/http-fetch/client.ts
 * ----------------------------------------------------------------------------
 * Wrapper protocol-agnostic para fetch.
 *
 * Não implementa contratos de core/. A adaptação para AppHttpClient vive
 * no app registry.
 * ========================================================================== */

export interface FetchClientConfig {
  baseURL: string;
  defaultHeaders?: Record<string, string>;
}

export interface FetchClientResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

export class FetchClient {
  constructor(private readonly config: FetchClientConfig) {}

  async request<T = unknown>(
    method: string,
    url: string,
    body?: unknown
  ): Promise<FetchClientResponse<T>> {
    const response = await fetch(`${this.config.baseURL}${url}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...this.config.defaultHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = (await response.json()) as T;
    const headers = Object.fromEntries(response.headers.entries());

    return {
      status: response.status,
      data,
      headers,
    };
  }
}
