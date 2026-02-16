import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { weaponScanLog, rivenAttributes } from "@/lib/db/schema";
import { getRivenItems, getRivenAttributes } from "@/lib/wfm/client";

/**
 * POST /api/reference/sync
 *
 * Syncs reference data (weapons + riven attributes) from Warframe Market API
 * into our local database. This avoids hitting WFM for every autocomplete/search.
 *
 * Weapons: Uses the full /riven/items list so Rank Value and Reroll Value
 * scans consider the maximum amount of guns (all riven-eligible weapons) from WFM.
 * All synced weapons are enabled so they are included in the scan queue.
 *
 * Rate-limit safe: makes exactly 2 API calls (items + attributes).
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Sync weapons (riven items) — full WFM list = maximum guns for Rank Value & Reroll Value
    const wfmItems = await getRivenItems();
    let weaponsSynced = 0;

    for (const item of wfmItems) {
      await db
        .insert(weaponScanLog)
        .values({
          weaponUrlName: item.url_name,
          weaponName: item.item_name,
          rivenType: item.riven_type ?? null,
          icon: item.icon ?? null,
          thumb: item.thumb ?? null,
          tier: "warm",
          enabled: true,
        })
        .onConflictDoUpdate({
          target: weaponScanLog.weaponUrlName,
          set: {
            weaponName: item.item_name,
            rivenType: item.riven_type ?? null,
            icon: item.icon ?? null,
            thumb: item.thumb ?? null,
            enabled: true,
          },
        });
      weaponsSynced++;
    }

    // 2. Sync riven attributes
    const wfmAttrs = await getRivenAttributes();
    let attrsSynced = 0;

    for (const attr of wfmAttrs) {
      await db
        .insert(rivenAttributes)
        .values({
          wfmId: attr.id,
          urlName: attr.url_name,
          effect: attr.effect,
          group: attr.group,
          prefix: attr.prefix ?? null,
          suffix: attr.suffix ?? null,
          units: attr.units ?? null,
          positiveIsNegative: attr.positive_is_negative ?? false,
          negativeOnly: attr.negative_only ?? false,
          searchOnly: attr.search_only ?? false,
          exclusiveTo: attr.exclusive_to ?? null,
        })
        .onConflictDoUpdate({
          target: rivenAttributes.urlName,
          set: {
            wfmId: attr.id,
            effect: attr.effect,
            group: attr.group,
            prefix: attr.prefix ?? null,
            suffix: attr.suffix ?? null,
            units: attr.units ?? null,
            positiveIsNegative: attr.positive_is_negative ?? false,
            negativeOnly: attr.negative_only ?? false,
            searchOnly: attr.search_only ?? false,
            exclusiveTo: attr.exclusive_to ?? null,
          },
        });
      attrsSynced++;
    }

    return NextResponse.json({
      ok: true,
      weaponsSynced,
      attrsSynced,
    });
  } catch (error) {
    console.error("[Reference Sync] Error:", error);
    return NextResponse.json(
      { error: "Failed to sync reference data" },
      { status: 500 }
    );
  }
}
