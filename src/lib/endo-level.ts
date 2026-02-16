/**
 * Endo cost to level a mod from rank 0 to max rank (10).
 * Used for investment dashboard "level price" (endo → plat equivalent).
 */

const PRIMED_ENDO_COST = 40_920;
const NORMAL_R10_ENDO_COST = 30_720;

/**
 * Returns the endo cost to level the mod from rank 0 to max rank (10).
 * Primed mods (url_name starts with "primed_") use 40,920; others use 30,720.
 */
export function getEndoCostForMaxRank(itemUrlName: string): number {
  const name = (itemUrlName || "").toLowerCase();
  return name.startsWith("primed_") ? PRIMED_ENDO_COST : NORMAL_R10_ENDO_COST;
}
