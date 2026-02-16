import { db } from "./db";
import { proxies } from "./db/schema";
import { eq } from "drizzle-orm";
import { TokenBucket } from "./wfm/rate-limiter";
import type { Proxy } from "./db/schema";

const RATE_LIMIT_PER_PROXY = 2.5; // tokens per second, slightly under 3
const MAX_FAIL_COUNT = 3;

export interface ProxyWithLimiter {
  proxy: Proxy;
  limiter: TokenBucket;
}

/**
 * In-memory proxy manager for a scan session.
 * Exclusive checkout/checkin: each proxy is assigned to one worker until checkin.
 * No concurrent reuse — prevents rate limits when many workers share the same IP.
 */
export class ProxyManager {
  private available: Proxy[] = [];
  private inUse = new Set<string>();
  private inUseProxies = new Map<string, Proxy>();
  private waiters: Array<(p: ProxyWithLimiter | null) => void> = [];
  private limiters = new Map<string, TokenBucket>();

  constructor(proxyList: Proxy[]) {
    this.available = proxyList.filter((p) => p.isAlive);
  }

  get count(): number {
    return this.available.length + this.inUse.size;
  }

  private getLimiter(proxyId: string): TokenBucket {
    let limiter = this.limiters.get(proxyId);
    if (!limiter) {
      limiter = new TokenBucket(3, RATE_LIMIT_PER_PROXY);
      this.limiters.set(proxyId, limiter);
    }
    return limiter;
  }

  private next(): ProxyWithLimiter | null {
    const proxy = this.available.shift();
    if (!proxy) return null;
    this.inUse.add(proxy.id);
    this.inUseProxies.set(proxy.id, proxy);
    return { proxy, limiter: this.getLimiter(proxy.id) };
  }

  /**
   * Exclusive acquire: take one proxy from the pool. Waits if all are in use.
   * Returns null only when there are no proxies left at all (all dead).
   */
  async checkout(): Promise<ProxyWithLimiter | null> {
    const p = this.next();
    if (p) return p;

    if (this.inUse.size === 0) {
      return null;
    }

    return new Promise<ProxyWithLimiter | null>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  /**
   * Return proxy to the pool after use. Fulfills a waiting checkout if any.
   */
  checkin(proxyId: string): void {
    const proxy = this.inUseProxies.get(proxyId);
    this.inUse.delete(proxyId);
    this.inUseProxies.delete(proxyId);
    if (proxy) {
      this.available.push(proxy);
    }
    const waiter = this.waiters.shift();
    if (waiter) {
      const out = this.next();
      waiter(out);
    }
  }

  /**
   * Mark proxy as failed. Increments fail count in DB; if >= MAX_FAIL_COUNT, marks dead.
   * Proxy is removed from pool. Wakes a waiting worker if any.
   */
  async markFailed(proxyId: string): Promise<void> {
    this.inUse.delete(proxyId);
    this.inUseProxies.delete(proxyId);

    const [row] = await db
      .select()
      .from(proxies)
      .where(eq(proxies.id, proxyId))
      .limit(1);

    if (!row) return;

    const newFailCount = row.failCount + 1;
    const isAlive = newFailCount < MAX_FAIL_COUNT;

    await db
      .update(proxies)
      .set({
        failCount: newFailCount,
        isAlive,
        lastFailedAt: new Date(),
      })
      .where(eq(proxies.id, proxyId));

    if (isAlive) {
      this.available.push(row);
    }

    const waiter = this.waiters.shift();
    if (waiter) {
      const out = this.next();
      waiter(out);
    }
  }

  /**
   * Mark proxy as success. Resets fail count in DB. Call checkin() after to return proxy to pool.
   */
  async markSuccess(proxyId: string): Promise<void> {
    await db
      .update(proxies)
      .set({
        failCount: 0,
        lastUsedAt: new Date(),
      })
      .where(eq(proxies.id, proxyId));
  }
}

/**
 * Load alive proxies from DB for use in a scan.
 */
export async function loadAliveProxies(): Promise<Proxy[]> {
  const list = await db
    .select()
    .from(proxies)
    .where(eq(proxies.isAlive, true));
  return list;
}
