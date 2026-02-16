import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  pgEnum,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Enums ──────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const scanStatusEnum = pgEnum("scan_status", [
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
]);
export const scanTriggerEnum = pgEnum("scan_trigger", ["manual", "auto"]);
export const weaponTierEnum = pgEnum("weapon_tier", ["hot", "warm", "cold"]);

// ─── Users ──────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  whisperTemplate: text("whisper_template").default(
    "/w {ign} Hi! I want to buy your {weapon_name} {riven_name} listed for {price}p"
  ),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Riven Snapshots ────────────────────────────────────────────────
export const rivenSnapshots = pgTable(
  "riven_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    wfmAuctionId: text("wfm_auction_id").notNull(),
    weaponUrlName: text("weapon_url_name").notNull(),
    weaponName: text("weapon_name").notNull(),
    reRolls: integer("re_rolls").notNull().default(0),
    modRank: integer("mod_rank").notNull().default(0),
    buyoutPrice: integer("buyout_price"),
    startingPrice: integer("starting_price"),
    attributes: jsonb("attributes").notNull().default([]),
    ownerIgn: text("owner_ign").notNull(),
    ownerStatus: text("owner_status").notNull().default("offline"),
    ownerReputation: integer("owner_reputation").notNull().default(0),
    polarity: text("polarity"),
    masteryLevel: integer("mastery_level").notNull().default(8),
    endoValue: integer("endo_value").notNull().default(0),
    endoPerPlat: real("endo_per_plat").notNull().default(0),
    isLiquid: boolean("is_liquid").notNull().default(false),
    isDirectSell: boolean("is_direct_sell").notNull().default(false),
    platform: text("platform").notNull().default("pc"),
    scanJobId: uuid("scan_job_id"),
    rivenName: text("riven_name"),
    wfmAuctionUrl: text("wfm_auction_url"),
    auctionCreatedAt: timestamp("auction_created_at"),
    auctionUpdatedAt: timestamp("auction_updated_at"),
    spottedAt: timestamp("spotted_at").notNull().defaultNow(),
    goneAt: timestamp("gone_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("riven_snapshots_auction_idx").on(table.wfmAuctionId),
    index("riven_snapshots_liquid_idx")
      .on(table.endoPerPlat)
      .where(sql`is_liquid = true`),
    index("riven_snapshots_weapon_idx").on(
      table.weaponUrlName,
      table.spottedAt
    ),
  ]
);

// ─── Weapon Scan Log ────────────────────────────────────────────────
export const weaponScanLog = pgTable("weapon_scan_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  weaponUrlName: text("weapon_url_name").notNull().unique(),
  weaponName: text("weapon_name").notNull().default(""),
  rivenType: text("riven_type"),
  icon: text("icon"),
  thumb: text("thumb"),
  enabled: boolean("enabled").notNull().default(true),
  lastScannedAt: timestamp("last_scanned_at"),
  auctionCount: integer("auction_count").notNull().default(0),
  liquidCount: integer("liquid_count").notNull().default(0),
  medianPrice: real("median_price"),
  medianEndoPerPlat: real("median_endo_per_plat"),
  tier: weaponTierEnum("tier").notNull().default("warm"),
  consecutiveEmpty: integer("consecutive_empty").notNull().default(0),
});

// ─── Scan Jobs ──────────────────────────────────────────────────────
export const scanJobs = pgTable(
  "scan_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: scanStatusEnum("status").notNull().default("running"),
    trigger: scanTriggerEnum("trigger").notNull().default("auto"),
    progress: integer("progress").notNull().default(0),
    totalWeapons: integer("total_weapons").notNull().default(0),
    foundDeals: integer("found_deals").notNull().default(0),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    pausedAt: timestamp("paused_at"),
    errorMessage: text("error_message"),
  },
  (table) => [index("scan_jobs_status_idx").on(table.status, table.startedAt)]
);

// ─── Proxies ────────────────────────────────────────────────────────
export const proxies = pgTable("proxies", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull(),
  label: text("label"),
  isAlive: boolean("is_alive").notNull().default(true),
  failCount: integer("fail_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  lastFailedAt: timestamp("last_failed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Riven Attributes (cached from WFM) ─────────────────────────────
export const rivenAttributes = pgTable("riven_attributes", {
  id: uuid("id").primaryKey().defaultRandom(),
  wfmId: text("wfm_id").notNull().unique(),
  urlName: text("url_name").notNull().unique(),
  effect: text("effect").notNull(),
  group: text("group").notNull().default("default"),
  prefix: text("prefix"),
  suffix: text("suffix"),
  units: text("units"),
  positiveIsNegative: boolean("positive_is_negative").notNull().default(false),
  negativeOnly: boolean("negative_only").notNull().default(false),
  searchOnly: boolean("search_only").notNull().default(false),
  exclusiveTo: text("exclusive_to"),
});

// ─── Endo Arb Scan Jobs ─────────────────────────────────────────────
export const endoArbJobs = pgTable(
  "endo_arb_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: scanStatusEnum("status").notNull().default("running"),
    trigger: scanTriggerEnum("trigger").notNull().default("auto"),
    progress: integer("progress").notNull().default(0),
    totalWeapons: integer("total_weapons").notNull().default(0),
    foundDeals: integer("found_deals").notNull().default(0),
    minReRolls: integer("min_re_rolls").notNull().default(50),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    pausedAt: timestamp("paused_at"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("endo_arb_jobs_status_idx").on(table.status, table.startedAt),
  ]
);

// ─── Endo Arb Deals ─────────────────────────────────────────────────
export const endoArbDeals = pgTable(
  "endo_arb_deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    wfmAuctionId: text("wfm_auction_id").notNull(),
    weaponUrlName: text("weapon_url_name").notNull(),
    weaponName: text("weapon_name").notNull(),
    reRolls: integer("re_rolls").notNull().default(0),
    modRank: integer("mod_rank").notNull().default(0),
    masteryLevel: integer("mastery_level").notNull().default(8),
    buyoutPrice: integer("buyout_price"),
    startingPrice: integer("starting_price"),
    attributes: jsonb("attributes").notNull().default([]),
    ownerIgn: text("owner_ign").notNull(),
    ownerStatus: text("owner_status").notNull().default("offline"),
    ownerReputation: integer("owner_reputation").notNull().default(0),
    polarity: text("polarity"),
    endoValue: integer("endo_value").notNull().default(0),
    endoPerPlat: real("endo_per_plat").notNull().default(0),
    isDirectSell: boolean("is_direct_sell").notNull().default(false),
    platform: text("platform").notNull().default("pc"),
    scanJobId: uuid("scan_job_id"),
    rivenName: text("riven_name"),
    wfmAuctionUrl: text("wfm_auction_url"),
    auctionCreatedAt: timestamp("auction_created_at"),
    auctionUpdatedAt: timestamp("auction_updated_at"),
    spottedAt: timestamp("spotted_at").notNull().defaultNow(),
    goneAt: timestamp("gone_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("endo_arb_deals_auction_idx").on(table.wfmAuctionId),
    index("endo_arb_deals_epp_idx").on(table.endoPerPlat),
    index("endo_arb_deals_weapon_idx").on(
      table.weaponUrlName,
      table.spottedAt
    ),
  ]
);

// ─── Tracked Deals (investment tracker — self-contained copies) ─────
export const trackedDealStatusEnum = pgEnum("tracked_deal_status", [
  "active",
  "archived",
]);

export const trackedDeals = pgTable(
  "tracked_deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Source context (informational only, no FK)
    source: text("source").notNull().default("rank_value"), // "rank_value" | "reroll_value"
    // Copied deal data — survives purges
    weaponUrlName: text("weapon_url_name").notNull(),
    weaponName: text("weapon_name").notNull(),
    rivenName: text("riven_name"),
    reRolls: integer("re_rolls").notNull().default(0),
    modRank: integer("mod_rank").notNull().default(0),
    masteryLevel: integer("mastery_level").notNull().default(8),
    buyPrice: integer("buy_price").notNull(), // what you paid
    endoValue: integer("endo_value").notNull().default(0),
    endoPerPlat: real("endo_per_plat").notNull().default(0),
    attributes: jsonb("attributes").notNull().default([]),
    polarity: text("polarity"),
    sellerIgn: text("seller_ign"),
    wfmAuctionUrl: text("wfm_auction_url"),
    platform: text("platform").notNull().default("pc"),
    // Tracker state
    status: trackedDealStatusEnum("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    archivedAt: timestamp("archived_at"),
  },
  (table) => [
    index("tracked_deals_status_idx").on(table.status, table.createdAt),
  ]
);

// ─── Tracked Income (plat earned from a tracked deal) ───────────────
export const trackedIncome = pgTable(
  "tracked_income",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackedDealId: uuid("tracked_deal_id")
      .notNull()
      .references(() => trackedDeals.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(), // plat earned
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("tracked_income_deal_idx").on(table.trackedDealId),
  ]
);

// ─── Investment Jobs (r10 mod statistics scan) ───────────────────────
export const investmentJobs = pgTable(
  "investment_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: scanStatusEnum("status").notNull().default("running"),
    trigger: scanTriggerEnum("trigger").notNull().default("manual"),
    progress: integer("progress").notNull().default(0),
    totalItems: integer("total_items").notNull().default(0),
    foundCount: integer("found_count").notNull().default(0),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    pausedAt: timestamp("paused_at"),
    errorMessage: text("error_message"),
    failedItems: jsonb("failed_items").$type<string[]>().default([]),
  },
  (table) => [
    index("investment_jobs_status_idx").on(table.status, table.startedAt),
  ]
);

// ─── Investment Snapshots (r0 vs r10 prices per item, both timeframes) ─
export const investmentSnapshots = pgTable(
  "investment_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    investmentJobId: uuid("investment_job_id").references(() => investmentJobs.id),
    itemUrlName: text("item_url_name").notNull(),
    endoCostR0ToR10: integer("endo_cost_r0_to_r10").notNull().default(0),
    levelPricePlat: real("level_price_plat").notNull().default(0),
    // 48h
    buyPriceR0_48h: integer("buy_price_r0_48h"),
    sellPriceR10_48h: integer("sell_price_r10_48h"),
    pnlPct_48h: real("pnl_pct_48h"),
    volumeR10_48h: integer("volume_r10_48h"),
    // 90d
    buyPriceR0_90d: integer("buy_price_r0_90d"),
    sellPriceR10_90d: integer("sell_price_r10_90d"),
    pnlPct_90d: real("pnl_pct_90d"),
    volumeR10_90d: integer("volume_r10_90d"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("investment_snapshots_item_idx").on(table.itemUrlName),
    index("investment_snapshots_created_idx").on(table.createdAt),
  ]
);

// ─── Mod Sales (leveled mods sold using endo bank) ──────────────────
export const modSales = pgTable(
  "mod_sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modName: text("mod_name").notNull(),
    buyPrice: integer("buy_price").notNull().default(0), // plat paid for r0 mod
    endoUsed: integer("endo_used").notNull().default(0), // endo spent to level
    sellPrice: integer("sell_price").notNull(), // plat earned selling r10
    note: text("note"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("mod_sales_created_idx").on(table.createdAt),
  ]
);

// ─── Watch (arbitrage watchlist + polling) ──────────────────────────
export const watchSourceEnum = pgEnum("watch_source", [
  "rank_value",
  "reroll_value",
]);
export const watchEventKindEnum = pgEnum("watch_event_kind", [
  "owner_online",
  "owner_offline",
  "price_change",
  "removed_404",
]);

export const watchedAuctions = pgTable(
  "watched_auctions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    wfmAuctionId: text("wfm_auction_id").notNull(),
    source: watchSourceEnum("source").notNull(),
    weaponUrlName: text("weapon_url_name").notNull(),
    weaponName: text("weapon_name").notNull(),
    rivenName: text("riven_name"),
    buyoutPrice: integer("buyout_price"),
    startingPrice: integer("starting_price"),
    ownerIgn: text("owner_ign").notNull(),
    ownerStatus: text("owner_status").notNull().default("offline"),
    wfmAuctionUrl: text("wfm_auction_url"),
    // Copied at add-time (no FK to deals); survives arbitrage purge
    endoPerPlat: real("endo_per_plat").notNull().default(0),
    endoValue: integer("endo_value").notNull().default(0),
    reRolls: integer("re_rolls").notNull().default(0),
    masteryLevel: integer("mastery_level"),
    auctionCreatedAt: timestamp("auction_created_at"),
    auctionUpdatedAt: timestamp("auction_updated_at"),
    // Last known state (updated by poller)
    lastOwnerStatus: text("last_owner_status").notNull().default("offline"),
    lastBuyoutPrice: integer("last_buyout_price"),
    lastStartingPrice: integer("last_starting_price"),
    lastEndoPerPlat: real("last_endo_per_plat"),
    lastEndoValue: integer("last_endo_value"),
    lastCheckedAt: timestamp("last_checked_at"),
    sellerLastSeenAt: timestamp("seller_last_seen_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("watched_auctions_wfm_id_idx").on(table.wfmAuctionId),
    index("watched_auctions_source_idx").on(table.source),
  ]
);

export const watchEvents = pgTable(
  "watch_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    watchedAuctionId: uuid("watched_auction_id").references(() => watchedAuctions.id, {
      onDelete: "set null",
    }),
    kind: watchEventKindEnum("kind").notNull(),
    previousValue: text("previous_value"), // status or price string
    currentValue: text("current_value"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    // When auction is deleted (e.g. 404), event keeps display context
    weaponName: text("weapon_name"),
    ownerIgn: text("owner_ign"),
    rivenName: text("riven_name"),
  },
  (table) => [
    index("watch_events_watched_idx").on(table.watchedAuctionId),
    index("watch_events_created_idx").on(table.createdAt),
  ]
);

export const watchSettings = pgTable("watch_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(120),
  running: boolean("running").notNull().default(false),
  lastRunAt: timestamp("last_run_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── App Settings ───────────────────────────────────────────────────
export const appSettings = pgTable("app_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Type Exports ───────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RivenSnapshot = typeof rivenSnapshots.$inferSelect;
export type NewRivenSnapshot = typeof rivenSnapshots.$inferInsert;
export type WeaponScanLogEntry = typeof weaponScanLog.$inferSelect;
export type ScanJob = typeof scanJobs.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type Proxy = typeof proxies.$inferSelect;
export type NewProxy = typeof proxies.$inferInsert;
export type RivenAttribute = typeof rivenAttributes.$inferSelect;
export type NewRivenAttribute = typeof rivenAttributes.$inferInsert;
export type EndoArbJob = typeof endoArbJobs.$inferSelect;
export type EndoArbDeal = typeof endoArbDeals.$inferSelect;
export type TrackedDeal = typeof trackedDeals.$inferSelect;
export type NewTrackedDeal = typeof trackedDeals.$inferInsert;
export type TrackedIncomeEntry = typeof trackedIncome.$inferSelect;
export type NewTrackedIncomeEntry = typeof trackedIncome.$inferInsert;
export type InvestmentJob = typeof investmentJobs.$inferSelect;
export type NewInvestmentJob = typeof investmentJobs.$inferInsert;
export type InvestmentSnapshot = typeof investmentSnapshots.$inferSelect;
export type NewInvestmentSnapshot = typeof investmentSnapshots.$inferInsert;
export type ModSale = typeof modSales.$inferSelect;
export type NewModSale = typeof modSales.$inferInsert;
export type WatchedAuction = typeof watchedAuctions.$inferSelect;
export type NewWatchedAuction = typeof watchedAuctions.$inferInsert;
export type WatchEvent = typeof watchEvents.$inferSelect;
export type NewWatchEvent = typeof watchEvents.$inferInsert;
export type WatchSettings = typeof watchSettings.$inferSelect;
export type NewWatchSettings = typeof watchSettings.$inferInsert;