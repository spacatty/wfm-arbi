import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rivenAttributes } from "@/lib/db/schema";

/**
 * GET /api/reference/attributes?riven_type=rifle
 *
 * Get riven stat attributes from local DB.
 * If riven_type provided, filters to attributes available for that type.
 * No WFM API calls.
 *
 * exclusiveTo may be:
 *  - null (universal)
 *  - a legacy single type string (e.g. "rifle")
 *  - a JSON array string (e.g. '["melee","zaw"]') from v2 sync
 */
function matchesRivenType(
  exclusiveTo: string | null,
  rivenType: string
): boolean {
  if (exclusiveTo == null || exclusiveTo === "") return true;
  if (exclusiveTo === rivenType) return true;
  if (exclusiveTo.startsWith("[")) {
    try {
      const parsed = JSON.parse(exclusiveTo) as unknown;
      return Array.isArray(parsed) && parsed.includes(rivenType);
    } catch {
      return false;
    }
  }
  return false;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rivenType = searchParams.get("riven_type");

  try {
    const rows = await db
      .select({
        urlName: rivenAttributes.urlName,
        effect: rivenAttributes.effect,
        group: rivenAttributes.group,
        units: rivenAttributes.units,
        positiveIsNegative: rivenAttributes.positiveIsNegative,
        negativeOnly: rivenAttributes.negativeOnly,
        searchOnly: rivenAttributes.searchOnly,
        exclusiveTo: rivenAttributes.exclusiveTo,
      })
      .from(rivenAttributes);

    const attributes = (
      rivenType
        ? rows.filter((a) => matchesRivenType(a.exclusiveTo, rivenType))
        : rows
    ).sort((a, b) => a.effect.localeCompare(b.effect));

    return NextResponse.json({ attributes });
  } catch (error) {
    console.error("[Reference Attributes] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch attributes" },
      { status: 500 }
    );
  }
}
