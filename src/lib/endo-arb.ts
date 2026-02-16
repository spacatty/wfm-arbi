/**
 * Endo Arbitrage Engine — Reroll-Aware
 *
 * Uses the real Warframe riven dissolution formula:
 *   endo = (100 × (MR - 8)) + (22.5 × 2^rank) + (200 × rerolls)
 *
 * Each reroll adds a flat 200 endo. High-reroll rivens with bad stats
 * are often priced cheaply but yield massive endo on dissolution.
 *
 * Benchmarks (same as base engine):
 * - Antivirus mod: 1,000 endo / 4p = 250 endo/plat
 * - Ayatan Anasa Sculpture (filled): 3,450 endo / 8-9p = 383-431 endo/plat
 */

import type { EndoBenchmarks } from "./endo";
import { getBenchmarkRates } from "./endo";

export interface EndoArbAnalysis {
  endoValue: number;
  endoPerPlat: number;
  isProfitable: boolean;
  liquidityThreshold: number;
  profitMargin: number;
  mrComponent: number;
  rankComponent: number;
  rerollComponent: number;
}

/**
 * Calculate exact endo from dissolving a riven using the real game formula.
 *
 *   endo = (100 × max(0, MR - 8)) + (22.5 × 2^rank) + (200 × rerolls)
 */
export function calcRivenEndoValue(
  masteryLevel: number,
  modRank: number,
  reRolls: number
): { total: number; mrComponent: number; rankComponent: number; rerollComponent: number } {
  const mrComponent = 100 * Math.max(0, masteryLevel - 8);
  const rankComponent = 22.5 * Math.pow(2, modRank);
  const rerollComponent = 200 * reRolls;
  const total = Math.floor(mrComponent + rankComponent + rerollComponent);
  return { total, mrComponent, rankComponent, rerollComponent };
}

/**
 * Analyze a riven's endo arbitrage potential using the full reroll-aware formula.
 */
export function analyzeRivenArb(
  masteryLevel: number,
  modRank: number,
  reRolls: number,
  buyoutPrice: number | null,
  benchmarks: EndoBenchmarks
): EndoArbAnalysis {
  const { total, mrComponent, rankComponent, rerollComponent } =
    calcRivenEndoValue(masteryLevel, modRank, reRolls);
  const { liquidityThreshold } = getBenchmarkRates(benchmarks);

  if (!buyoutPrice || buyoutPrice <= 0) {
    return {
      endoValue: total,
      endoPerPlat: 0,
      isProfitable: false,
      liquidityThreshold,
      profitMargin: -liquidityThreshold,
      mrComponent,
      rankComponent,
      rerollComponent,
    };
  }

  const endoPerPlat = total / buyoutPrice;
  const isProfitable = endoPerPlat > liquidityThreshold;
  const profitMargin = endoPerPlat - liquidityThreshold;

  return {
    endoValue: total,
    endoPerPlat,
    isProfitable,
    liquidityThreshold,
    profitMargin,
    mrComponent,
    rankComponent,
    rerollComponent,
  };
}

/** Default minimum rerolls to scan for (each = 200 endo) */
export const DEFAULT_MIN_RE_ROLLS = 50;

/**
 * Reroll range bands for thorough scanning.
 * Each band makes a separate API call per weapon to avoid any hidden result caps.
 * The bands are: [5-14], [15-29], [30-59], [60+]
 */
export const REROLL_BANDS: { min: number; max?: number }[] = [
  { min: 5, max: 14 },
  { min: 15, max: 29 },
  { min: 30, max: 59 },
  { min: 60 },
];

/** Minimum buyout price to consider (filters out fake 1p listings) */
export const MIN_BUYOUT_PRICE = 5;
