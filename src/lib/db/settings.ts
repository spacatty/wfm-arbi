import { db } from "./index";
import { appSettings } from "./schema";
import { eq } from "drizzle-orm";
import type { EndoBenchmarks } from "../endo";
import { DEFAULT_ENDO_BY_RANK } from "../endo";

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(appSettings);
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

export async function getBenchmarksFromDB(): Promise<EndoBenchmarks> {
  const settings = await getAllSettings();
  let endoByRank = DEFAULT_ENDO_BY_RANK;

  try {
    if (settings.endo_by_rank) {
      endoByRank = JSON.parse(settings.endo_by_rank);
    }
  } catch {
    // use defaults
  }

  return {
    antivirusModPrice: Number(settings.antivirus_mod_price) || 4,
    ayatanAnasaPrice: Number(settings.ayatan_anasa_price) || 9,
    endoByRank,
  };
}
