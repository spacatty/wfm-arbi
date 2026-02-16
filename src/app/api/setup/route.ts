import { NextResponse } from "next/server";
import bcryptjs from "bcryptjs";
import { db } from "@/lib/db";
import { users, appSettings } from "@/lib/db/schema";
import { count } from "drizzle-orm";
import { DEFAULT_ENDO_BY_RANK } from "@/lib/endo";

export async function POST(request: Request) {
  try {
    // Ensure no users exist yet
    const [result] = await db.select({ count: count() }).from(users);
    if (result.count > 0) {
      return NextResponse.json({ error: "Setup already completed" }, { status: 400 });
    }

    const body = await request.json();
    const { email, password, name, antivirusPrice, ayatanPrice } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Create admin user
    const passwordHash = await bcryptjs.hash(password, 12);
    const [admin] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name,
        role: "admin",
      })
      .returning();

    // Seed default app settings
    const defaultSettings = [
      { key: "auto_scan_enabled", value: "true" },
      { key: "scan_interval_minutes", value: process.env.DEFAULT_SCAN_INTERVAL_MINUTES || "60" },
      {
        key: "liquidity_threshold",
        value: process.env.DEFAULT_LIQUIDITY_THRESHOLD || "400",
      },
      {
        key: "antivirus_mod_price",
        value: String(antivirusPrice || process.env.DEFAULT_ANTIVIRUS_PRICE || 4),
      },
      {
        key: "ayatan_anasa_price",
        value: String(ayatanPrice || process.env.DEFAULT_AYATAN_ANASA_PRICE || 9),
      },
      {
        key: "endo_by_rank",
        value: JSON.stringify(DEFAULT_ENDO_BY_RANK),
      },
      { key: "use_proxies", value: "false" },
      { key: "worker_count", value: process.env.DEFAULT_WORKER_COUNT || "5" },
    ];

    for (const setting of defaultSettings) {
      await db
        .insert(appSettings)
        .values(setting)
        .onConflictDoNothing();
    }

    return NextResponse.json({
      success: true,
      user: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json({ error: "Setup failed" }, { status: 500 });
  }
}
