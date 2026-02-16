import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { proxies } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import nodeFetch from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import type { Agent } from "node:http";

// Disable TLS verification for proxy testing (SOCKS proxies often MITM TLS)
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

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id } = body as { id?: string };
    if (!id) {
      return NextResponse.json({ error: "Provide proxy id" }, { status: 400 });
    }

    const [proxy] = await db
      .select()
      .from(proxies)
      .where(eq(proxies.id, id))
      .limit(1);

    if (!proxy) {
      return NextResponse.json({ error: "Proxy not found" }, { status: 404 });
    }

    const agent = buildAgent(proxy.url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const res = await nodeFetch("https://httpbin.org/ip", {
      agent,
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.ok) {
      const data = (await res.json()) as { origin?: string };
      return NextResponse.json({ ok: true, status: res.status, ip: data.origin });
    }
    return NextResponse.json({
      ok: false,
      status: res.status,
      error: res.statusText,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 200 }
    );
  }
}
