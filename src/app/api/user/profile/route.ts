import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const NEW_DEFAULT =
  "/w {ign} Hi! I want to buy your {weapon_name} {riven_name} listed for {price}p";

/** Old defaults that should be auto-migrated to the new one */
const OLD_DEFAULTS = new Set([
  "/w {ign} Hi! I want to buy your [{riven_name}] listed for {price}p. (warframe.market)",
  "/w {ign} Hi! I want to buy your {weapon_name} [{riven_name}] listed for {price}p. (warframe.market)",
]);

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      name: users.name,
      email: users.email,
      whisperTemplate: users.whisperTemplate,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Auto-migrate old default templates
  const template =
    user.whisperTemplate && OLD_DEFAULTS.has(user.whisperTemplate)
      ? NEW_DEFAULT
      : (user.whisperTemplate ?? NEW_DEFAULT);

  return NextResponse.json({
    name: user.name,
    email: user.email,
    whisperTemplate: template,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { whisperTemplate } = body as { whisperTemplate?: string };

    if (typeof whisperTemplate !== "string") {
      return NextResponse.json(
        { error: "whisperTemplate must be a string" },
        { status: 400 }
      );
    }

    await db
      .update(users)
      .set({ whisperTemplate })
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
