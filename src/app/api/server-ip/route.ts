import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * GET /api/server-ip
 * Returns the public IP address of this server by querying an external service.
 * Cached for 5 minutes in-memory.
 */

let cachedIp: string | null = null;
let cachedAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function getPublicIp(): Promise<string> {
  if (cachedIp && Date.now() - cachedAt < CACHE_TTL) {
    return cachedIp;
  }

  // Try multiple services in case one is down
  const services = [
    "https://api.ipify.org?format=json",
    "https://httpbin.org/ip",
    "https://ifconfig.me/ip",
  ];

  for (const url of services) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("json")) {
        const data = (await res.json()) as { ip?: string; origin?: string };
        const ip = data.ip || data.origin;
        if (ip) {
          cachedIp = ip.trim();
          cachedAt = Date.now();
          return cachedIp;
        }
      } else {
        const text = await res.text();
        if (text.trim()) {
          cachedIp = text.trim();
          cachedAt = Date.now();
          return cachedIp;
        }
      }
    } catch {
      continue;
    }
  }

  throw new Error("Could not determine public IP");
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ip = await getPublicIp();
    return NextResponse.json({ ip });
  } catch {
    return NextResponse.json({ ip: null, error: "Could not determine IP" });
  }
}
