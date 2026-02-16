import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { weaponScanLog } from "@/lib/db/schema";
import { or, ilike } from "drizzle-orm";

/**
 * GET /api/reference/weapons?q=rub
 *
 * Fuzzy search weapons from local DB.
 * No WFM API calls - instant autocomplete.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  try {
    let query = db
      .select({
        urlName: weaponScanLog.weaponUrlName,
        weaponName: weaponScanLog.weaponName,
        rivenType: weaponScanLog.rivenType,
        icon: weaponScanLog.icon,
        thumb: weaponScanLog.thumb,
      })
      .from(weaponScanLog);

    if (q.length > 0) {
      const pattern = `%${q}%`;
      query = query.where(
        or(
          ilike(weaponScanLog.weaponName, pattern),
          ilike(weaponScanLog.weaponUrlName, pattern)
        )
      ) as typeof query;
    }

    const weapons = await query
      .orderBy(weaponScanLog.weaponName)
      .limit(20);

    return NextResponse.json({ weapons });
  } catch (error) {
    console.error("[Reference Weapons] Error:", error);
    return NextResponse.json(
      { error: "Failed to search weapons" },
      { status: 500 }
    );
  }
}
