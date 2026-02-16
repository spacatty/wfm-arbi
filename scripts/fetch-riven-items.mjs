/**
 * Fetches the full riven-eligible weapons list from Warframe Market API (by-hand).
 * Used to ensure Rank Value and Reroll Value scans use the maximum amount of guns
 * across all Warframe market data.
 *
 * Run: node scripts/fetch-riven-items.mjs
 *      npm run fetch:riven-items  (if added to package.json)
 *
 * To populate the app DB with this list, use POST /api/reference/sync (Admin or Search page).
 */

const WFM_RIVEN_ITEMS = "https://api.warframe.market/v1/riven/items";

async function main() {
  console.log("[WFM] Fetching riven items from", WFM_RIVEN_ITEMS);
  const res = await fetch(WFM_RIVEN_ITEMS, {
    headers: { Language: "en", Platform: "pc", Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`WFM API error: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const items = json.payload?.items ?? [];
  console.log("[WFM] Received", items.length, "riven-eligible weapons (maximum guns for Rank Value & Reroll Value).");
  if (items.length > 0) {
    const byType = {};
    for (const w of items) {
      const t = w.riven_type ?? "unknown";
      byType[t] = (byType[t] || 0) + 1;
    }
    console.log("[WFM] By riven_type:", byType);
  }
  console.log("[WFM] To populate the app, run POST /api/reference/sync (e.g. from Admin page).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
