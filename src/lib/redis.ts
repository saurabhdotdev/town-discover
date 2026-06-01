let client: any = null;
let isRedisConnected = false;
let isConnecting = false;

// Fallback in-memory cache
const memoryCache = new Map<string, { value: any; expiresAt: number }>();

const getMemoryCache = (key: string): any | null => {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return item.value;
};

const setMemoryCache = (key: string, value: any, ttlSeconds: number) => {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
};

export const initRedis = async (): Promise<any | null> => {
  const url = process.env.REDIS_URL;
  if (!url) {
    return null;
  }

  if (client) return client;
  if (isConnecting) return null;

  isConnecting = true;
  try {
    const redisModule = "redis";
    const { createClient } = await import(redisModule);
    
    const tempClient = createClient({
      url,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries: number) => {
          if (retries > 3) {
            console.warn("Redis: Maximum reconnect attempts reached. Disabling Redis client.");
            isRedisConnected = false;
            return false; // stop reconnecting
          }
          return Math.min(retries * 500, 2000);
        },
      },
    });

    tempClient.on("error", (err: any) => {
      console.error("Redis error details:", err.message);
      isRedisConnected = false;
    });

    tempClient.on("connect", () => {
      console.log("Redis connected successfully.");
      isRedisConnected = true;
    });

    tempClient.on("end", () => {
      isRedisConnected = false;
    });

    await tempClient.connect();
    client = tempClient;
    return client;
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
    isRedisConnected = false;
    return null;
  } finally {
    isConnecting = false;
  }
};

// Initialize connection asynchronously on import (non-blocking server side)
if (typeof window === "undefined" && process.env.REDIS_URL) {
  initRedis().catch(() => {});
}

export async function getCache<T>(key: string): Promise<T | null> {
  // If we are in client/browser environment, skip
  if (typeof window !== "undefined") return null;

  if (process.env.REDIS_URL) {
    try {
      const activeClient = await initRedis();
      if (activeClient && isRedisConnected) {
        const data = await activeClient.get(key);
        if (data) {
          return JSON.parse(data) as T;
        }
      }
    } catch (err) {
      console.error(`Redis get error for key ${key}:`, err);
    }
  }

  // Fallback to memory
  return getMemoryCache(key) as T | null;
}

export async function setCache<T>(key: string, value: T, ttlSeconds = 600): Promise<void> {
  if (typeof window !== "undefined") return;

  if (process.env.REDIS_URL) {
    try {
      const activeClient = await initRedis();
      if (activeClient && isRedisConnected) {
        const serialized = JSON.stringify(value);
        await activeClient.set(key, serialized, {
          EX: ttlSeconds,
        });
        return;
      }
    } catch (err) {
      console.error(`Redis set error for key ${key}:`, err);
    }
  }

  // Fallback to memory
  setMemoryCache(key, value, ttlSeconds);
}
