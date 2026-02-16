import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { proxies } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import nodeFetch from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import type { Agent } from "node:http";

const CHECK_URL = "https://httpbin.org/ip";
const CONCURRENCY = 200;
const TIMEOUT_MS = 4000;

/** Allow long execution for large proxy lists. */
export const maxDuration = 300;

// Disable TLS verification for proxy checking (SOCKS proxies often MITM TLS)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function buildAgent(proxyUrl: string): Agent {
  if (
    proxyUrl.startsWith("socks://") ||
    proxyUrl.startsWith("socks4://") ||
    proxyUrl.startsWith("socks5://") ||
    proxyUrl.startsWith("socks4a://") ||
    proxyUrl.startsWith("socks5h://")
  ) {
    return new SocksProxyAgent(proxyUrl) as unknown as Agent;
  }
  return new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false }) as unknown as Agent;
}

async function checkProxy(url: string): Promise<boolean> {
  try {
    const agent = buildAgent(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await nodeFetch(CHECK_URL, {
      agent,
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * POST /api/proxies/check-all
 * Test all proxies via httpbin.org/ip at high concurrency.
 * Marks alive on 200, removes dead in bulk. Returns summary.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const list = await db.select().from(proxies);
    const total = list.length;
    console.log(`[Proxy Check] Starting check of ${total} proxies (concurrency ${CONCURRENCY})...`);

    if (total === 0) {
      return NextResponse.json({ checked: 0, alive: 0, deadRemoved: 0 });
    }

    let alive = 0;
    let deadRemoved = 0;
    const totalBatches = Math.ceil(total / CONCURRENCY);

    for (let i = 0; i < total; i += CONCURRENCY) {
      const batch = list.slice(i, i + CONCURRENCY);
      const batchNum = Math.floor(i / CONCURRENCY) + 1;
      console.log(`[Proxy Check] Batch ${batchNum}/${totalBatches} (${batch.length} proxies)...`);

      const results = await Promise.all(
        batch.map(async (proxy) => {
          const ok = await checkProxy(proxy.url);
          return { id: proxy.id, ok };
        })
      );

      const aliveIds = results.filter((r) => r.ok).map((r) => r.id);
      const deadIds = results.filter((r) => !r.ok).map((r) => r.id);

      // Bulk DB updates — single query per status instead of per-proxy
      if (aliveIds.length > 0) {
        await db
          .update(proxies)
          .set({ failCount: 0, isAlive: true, lastUsedAt: new Date() })
          .where(inArray(proxies.id, aliveIds));
      }

      if (deadIds.length > 0) {
        await db.delete(proxies).where(inArray(proxies.id, deadIds));
      }

      alive += aliveIds.length;
      deadRemoved += deadIds.length;

      console.log(
        `[Proxy Check] Batch ${batchNum}/${totalBatches}: ${aliveIds.length} alive, ${deadIds.length} dead (${Math.min(i + CONCURRENCY, total)}/${total})`
      );
    }

    console.log(`[Proxy Check] Complete: ${alive} alive, ${deadRemoved} removed out of ${total}`);

    return NextResponse.json({ checked: total, alive, deadRemoved });
  } catch (error) {
    console.error("[Proxy Check] Error:", error);
    return NextResponse.json({ error: "Failed to check proxies" }, { status: 500 });
  }
}
