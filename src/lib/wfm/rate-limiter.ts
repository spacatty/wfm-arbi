/**
 * Token Bucket Rate Limiter
 * Enforces the WFM API rate limit of 3 requests per second.
 * Shared singleton across the process.
 * Exported for per-proxy limiters in proxy manager.
 */
export class TokenBucket {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms
  private lastRefill: number;
  private waitQueue: (() => void)[] = [];

  constructor(maxTokens: number, refillPerSecond: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait until a token is available
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    return new Promise((resolve) => {
      setTimeout(() => {
        this.refill();
        this.tokens -= 1;
        resolve();
      }, waitMs);
    });
  }
}

// Singleton: 3 tokens/sec, burst of 3
let instance: TokenBucket | null = null;

export function getRateLimiter(): TokenBucket {
  if (!instance) {
    instance = new TokenBucket(3, 2.5); // slightly under 3/s to be safe
  }
  return instance;
}
