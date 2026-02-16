import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { count } from "drizzle-orm";

export async function GET() {
  try {
    const [result] = await db.select({ count: count() }).from(users);
    return NextResponse.json({ hasUsers: result.count > 0 });
  } catch {
    // DB might not be migrated yet
    return NextResponse.json({ hasUsers: false });
  }
}
