/**
 * Endo Liquidity Engine
 *
 * Calculates whether buying a riven and dissolving it for endo
 * is cheaper than buying endo through other sources.
 *
 * Benchmarks:
 * - Antivirus mod: 1,000 endo / 4p = 250 endo/plat
 * - Ayatan Anasa Sculpture (filled): 3,450 endo / 8-9p = 383-431 endo/plat
 *
 * A riven is "liquid" if its endo/plat beats the best benchmark.
 */

// Default endo values from dissolving rivens by mod rank
// These are approximate and configurable in admin settings
export const DEFAULT_ENDO_BY_RANK: Record<number, number> = {
  0: 900,
  1: 1000,
  2: 1200,
  3: 1400,
  4: 1700,
  5: 2000,
  6: 2350,
  7: 2700,
  8: 3150,
};

export const ANTIVIRUS_MOD_ENDO = 1000;
export const AYATAN_ANASA_ENDO = 3450;

export interface EndoBenchmarks {
  antivirusModPrice: number; // plat cost of an antivirus mod
  ayatanAnasaPrice: number; // plat cost of a filled ayatan anasa
  endoByRank: Record<number, number>;
}

export interface EndoAnalysis {
  endoValue: number;
  endoPerPlat: number;
  isLiquid: boolean;
  liquidityThreshold: number;
  profitMargin: number; // endo/plat above threshold (positive = profitable)
  antivirusRate: number;
  ayatanRate: number;
}

/**
 * Calculate the endo/plat rate for benchmark sources
 */
export function getBenchmarkRates(benchmarks: EndoBenchmarks) {
  const antivirusRate = ANTIVIRUS_MOD_ENDO / benchmarks.antivirusModPrice;
  const ayatanRate = AYATAN_ANASA_ENDO / benchmarks.ayatanAnasaPrice;
  // The best (highest) rate is the threshold - rivens must beat this
  const liquidityThreshold = Math.max(antivirusRate, ayatanRate);

  return { antivirusRate, ayatanRate, liquidityThreshold };
}

/**
 * Real Warframe riven dissolution formula:
 *   endo = (100 × max(0, MR - 8)) + (22.5 × 2^rank) + (200 × rerolls)
 */
export function calcRivenEndoValue(
  masteryLevel: number,
  modRank: number,
  reRolls: number
): number {
  const mrComponent = 100 * Math.max(0, masteryLevel - 8);
  const rankComponent = 22.5 * Math.pow(2, modRank);
  const rerollComponent = 200 * reRolls;
  return Math.floor(mrComponent + rankComponent + rerollComponent);
}

/**
 * Analyze a riven's endo arbitrage potential using the real formula (MR + rank + rerolls).
 */
export function analyzeRiven(
  masteryLevel: number,
  modRank: number,
  reRolls: number,
  buyoutPrice: number | null,
  benchmarks: EndoBenchmarks
): EndoAnalysis {
  const endoValue = calcRivenEndoValue(masteryLevel, modRank, reRolls);
  const { antivirusRate, ayatanRate, liquidityThreshold } = getBenchmarkRates(benchmarks);

  if (!buyoutPrice || buyoutPrice <= 0) {
    return {
      endoValue,
      endoPerPlat: 0,
      isLiquid: false,
      liquidityThreshold,
      profitMargin: -liquidityThreshold,
      antivirusRate,
      ayatanRate,
    };
  }

  const endoPerPlat = endoValue / buyoutPrice;
  const isLiquid = endoPerPlat > liquidityThreshold;
  const profitMargin = endoPerPlat - liquidityThreshold;

  return {
    endoValue,
    endoPerPlat,
    isLiquid,
    liquidityThreshold,
    profitMargin,
    antivirusRate,
    ayatanRate,
  };
}

/**
 * Get the default benchmarks from environment or fallback
 */
export function getDefaultBenchmarks(): EndoBenchmarks {
  return {
    antivirusModPrice: Number(process.env.DEFAULT_ANTIVIRUS_PRICE) || 4,
    ayatanAnasaPrice: Number(process.env.DEFAULT_AYATAN_ANASA_PRICE) || 9,
    endoByRank: DEFAULT_ENDO_BY_RANK,
  };
}
