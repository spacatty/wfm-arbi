import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { proxies } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    if (u.username) u.username = u.username.slice(0, 2) + "***";
    return u.toString();
  } catch {
    return url.replace(/:[^:@]+@/, ":***@");
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const list = await db.select().from(proxies).orderBy(proxies.createdAt);
    return NextResponse.json({
      proxies: list.map((p) => ({
        id: p.id,
        url: maskUrl(p.url),
        label: p.label,
        isAlive: p.isAlive,
        failCount: p.failCount,
        lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
        lastFailedAt: p.lastFailedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("Proxies GET error:", error);
    return NextResponse.json(
      { error: "Failed to list proxies" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { url, urls } = body as { url?: string; urls?: string };

    const toAdd: string[] = [];
    if (typeof url === "string" && url.trim()) toAdd.push(url.trim());
    if (typeof urls === "string") {
      const lines = urls.split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean);
      toAdd.push(...lines);
    }

    if (toAdd.length === 0) {
      return NextResponse.json(
        { error: "Provide url (string) or urls (newline-separated string)" },
        { status: 400 }
      );
    }

    const inserted = await db
      .insert(proxies)
      .values(toAdd.map((u) => ({ url: u })))
      .returning({ id: proxies.id });

    return NextResponse.json({ added: inserted.length });
  } catch (error) {
    console.error("Proxies POST error:", error);
    return NextResponse.json(
      { error: "Failed to add proxies" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const removeDead = searchParams.get("removeDead") === "true";
    const removeAll = searchParams.get("removeAll") === "true";

    if (id) {
      await db.delete(proxies).where(eq(proxies.id, id));
      return NextResponse.json({ deleted: 1 });
    }

    if (removeAll) {
      const deleted = await db.delete(proxies).returning({ id: proxies.id });
      return NextResponse.json({ deleted: deleted.length });
    }

    if (removeDead) {
      const deleted = await db
        .delete(proxies)
        .where(eq(proxies.isAlive, false))
        .returning({ id: proxies.id });
      return NextResponse.json({ deleted: deleted.length });
    }

    return NextResponse.json(
      { error: "Provide id, removeDead=true, or removeAll=true" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Proxies DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete proxies" },
      { status: 500 }
    );
  }
}
