import Redis from 'ioredis';
import {loggers} from './observability';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * TTL configuration (in seconds) - read from environment with defaults
 */
export const redisTTL = {
  chatSession: parseInt(process.env.REDIS_TTL_CHAT_SESSION || '3600', 10),
  recommendSession: parseInt(process.env.REDIS_TTL_RECOMMEND_SESSION || '3600', 10),
  descriptionCache: parseInt(process.env.REDIS_TTL_DESCRIPTION_CACHE || '86400', 10),
};

let redisClient: Redis | null = null;

/**
 * Get Redis client singleton
 */
export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      loggers.http.info('Redis connected');
    });

    redisClient.on('error', (err) => {
      loggers.http.error({err}, 'Redis error');
    });
  }
  return redisClient;
}

/**
 * Session store with Redis backend
 * Generic wrapper for storing typed session data
 */
export class RedisSessionStore<T> {
  private prefix: string;
  private ttlSeconds: number;

  constructor(prefix: string, ttlSeconds: number = 3600) {
    this.prefix = prefix;
    this.ttlSeconds = ttlSeconds;
  }

  private key(id: string): string {
    return `${this.prefix}:${id}`;
  }

  async get(id: string): Promise<T | null> {
    const redis = getRedis();
    const data = await redis.get(this.key(id));
    if (!data) return null;
    return JSON.parse(data) as T;
  }

  async set(id: string, value: T): Promise<void> {
    const redis = getRedis();
    await redis.setex(this.key(id), this.ttlSeconds, JSON.stringify(value));
  }

  async delete(id: string): Promise<void> {
    const redis = getRedis();
    await redis.del(this.key(id));
  }

  async exists(id: string): Promise<boolean> {
    const redis = getRedis();
    return (await redis.exists(this.key(id))) === 1;
  }

  async refresh(id: string): Promise<void> {
    const redis = getRedis();
    await redis.expire(this.key(id), this.ttlSeconds);
  }
}

/**
 * Cache store with Redis backend
 * For caching expensive operations like LLM calls
 */
export class RedisCacheStore<T> {
  private prefix: string;
  private ttlSeconds: number;

  constructor(prefix: string, ttlSeconds: number = 86400) {
    this.prefix = prefix;
    this.ttlSeconds = ttlSeconds;
  }

  private key(id: string): string {
    return `${this.prefix}:${id}`;
  }

  async get(id: string): Promise<T | null> {
    const redis = getRedis();
    const data = await redis.get(this.key(id));
    if (!data) return null;
    return JSON.parse(data) as T;
  }

  async set(id: string, value: T): Promise<void> {
    const redis = getRedis();
    await redis.setex(this.key(id), this.ttlSeconds, JSON.stringify(value));
  }

  async delete(id: string): Promise<void> {
    const redis = getRedis();
    await redis.del(this.key(id));
  }

  async clear(): Promise<void> {
    const redis = getRedis();
    const keys = await redis.keys(`${this.prefix}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }

  async has(id: string): Promise<boolean> {
    const redis = getRedis();
    return (await redis.exists(this.key(id))) === 1;
  }
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
