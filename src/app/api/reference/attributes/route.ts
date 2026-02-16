import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rivenAttributes } from "@/lib/db/schema";
import { or, eq, isNull } from "drizzle-orm";

/**
 * GET /api/reference/attributes?riven_type=rifle
 *
 * Get riven stat attributes from local DB.
 * If riven_type provided, filters to attributes available for that type.
 * No WFM API calls.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rivenType = searchParams.get("riven_type");

  try {
    let query = db
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

    if (rivenType) {
      // Show attributes that are either universal (exclusiveTo IS NULL) or specific to this type
      query = query.where(
        or(
          isNull(rivenAttributes.exclusiveTo),
          eq(rivenAttributes.exclusiveTo, rivenType)
        )
      ) as typeof query;
    }

    const attributes = await query.orderBy(rivenAttributes.effect);

    return NextResponse.json({ attributes });
  } catch (error) {
    console.error("[Reference Attributes] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch attributes" },
      { status: 500 }
    );
  }
}
