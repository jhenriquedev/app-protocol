/* ========================================================================== *
 * packages/cache-redis/client.ts
 * ----------------------------------------------------------------------------
 * Wrapper protocol-agnostic de Redis.
 *
 * Expõe API própria — NÃO implementa contratos de core/.
 * Não sabe que AppCache existe. A adaptação vive em apps/.
 * ========================================================================== */

export interface RedisConfig {
  host: string;
  port?: number;
  password?: string;
  db?: number;
}

/**
 * Client Redis puro.
 *
 * Em projeto real, wrapperia ioredis ou redis.
 * Aqui serve como referência de contrato de packages/.
 */
export class RedisClient {
  private readonly config: RedisConfig;

  constructor(config: RedisConfig) {
    this.config = config;
  }

  async get(key: string): Promise<string | null> {
    // placeholder — em projeto real: return this.client.get(key)
    void key;
    return null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    // placeholder — em projeto real: this.client.set(key, value, "EX", ttl)
    void key;
    void value;
    void ttlSeconds;
  }

  async del(key: string): Promise<void> {
    // placeholder — em projeto real: this.client.del(key)
    void key;
  }

  async ping(): Promise<string> {
    return "PONG";
  }

  getConfig(): Readonly<RedisConfig> {
    return this.config;
  }
}
