import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { weaponScanLog } from "@/lib/db/schema";
import { asc, inArray } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const weapons = await db
      .select({
        weaponUrlName: weaponScanLog.weaponUrlName,
        weaponName: weaponScanLog.weaponName,
        rivenType: weaponScanLog.rivenType,
        enabled: weaponScanLog.enabled,
        tier: weaponScanLog.tier,
        lastScannedAt: weaponScanLog.lastScannedAt,
        liquidCount: weaponScanLog.liquidCount,
        auctionCount: weaponScanLog.auctionCount,
      })
      .from(weaponScanLog)
      .orderBy(asc(weaponScanLog.rivenType), asc(weaponScanLog.weaponName));

    return NextResponse.json({ weapons });
  } catch (error) {
    console.error("Weapons API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch weapons" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { weaponUrlNames, enabled } = body as {
      weaponUrlNames?: string[];
      enabled?: boolean;
    };

    if (!Array.isArray(weaponUrlNames) || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "Invalid body: need weaponUrlNames (string[]) and enabled (boolean)" },
        { status: 400 }
      );
    }

    if (weaponUrlNames.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    await db
      .update(weaponScanLog)
      .set({ enabled })
      .where(inArray(weaponScanLog.weaponUrlName, weaponUrlNames));

    return NextResponse.json({ updated: weaponUrlNames.length });
  } catch (error) {
    console.error("Weapons PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update weapons" },
      { status: 500 }
    );
  }
}
