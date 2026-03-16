/* ========================================================================== *
 * packages/http-axios/client.ts
 * ----------------------------------------------------------------------------
 * Wrapper protocol-agnostic de HTTP client (estilo Axios).
 *
 * Expõe API própria — NÃO implementa contratos de core/.
 * Não sabe que AppHttpClient existe. A adaptação vive em apps/.
 * ========================================================================== */

export interface AxiosClientConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface AxiosResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

/**
 * Client HTTP puro (estilo Axios).
 *
 * Em projeto real, wrapperia axios.
 * Aqui serve como referência de contrato de packages/.
 */
export class AxiosClient {
  private readonly config: AxiosClientConfig;

  constructor(config: AxiosClientConfig = {}) {
    this.config = config;
  }

  async request<T = unknown>(
    method: string,
    url: string,
    body?: unknown
  ): Promise<AxiosResponse<T>> {
    // placeholder — em projeto real: return axios({ method, url, data: body })
    const fullUrl = `${this.config.baseURL ?? ""}${url}`;
    void fullUrl;
    void body;
    return {
      status: 200,
      data: {} as T,
      headers: {},
    };
  }

  async get<T = unknown>(url: string): Promise<AxiosResponse<T>> {
    return this.request<T>("GET", url);
  }

  async post<T = unknown>(
    url: string,
    body: unknown
  ): Promise<AxiosResponse<T>> {
    return this.request<T>("POST", url, body);
  }

  getConfig(): Readonly<AxiosClientConfig> {
    return this.config;
  }
}
