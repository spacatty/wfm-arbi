// ─── Riven Items (weapons that can have rivens) ─────────────────────
export interface WfmRivenItem {
  id: string;
  url_name: string;
  group: string; // primary, secondary, melee, zaw, sentinel, archgun, kitgun
  riven_type: string; // shotgun, rifle, pistol, melee, zaw, kitgun
  icon: string;
  icon_format: string;
  thumb: string;
  item_name: string;
}

// ─── Riven Attributes ───────────────────────────────────────────────
export interface WfmRivenAttribute {
  id: string;
  url_name: string;
  group: string;
  prefix: string;
  suffix: string;
  positive_is_negative: boolean;
  exclusive_to: string | null;
  effect: string;
  units: string | null;
  negative_only: boolean;
  search_only: boolean;
}

// ─── Auction Item (the riven mod inside an auction) ─────────────────
export interface WfmRivenAuctionItem {
  type: "riven";
  attributes: {
    positive: boolean;
    value: number;
    url_name: string;
  }[];
  name: string;
  mastery_level: number;
  re_rolls: number;
  weapon_url_name: string;
  polarity: string;
  mod_rank: number;
}

// ─── Auction Owner ──────────────────────────────────────────────────
export interface WfmAuctionOwner {
  id: string;
  ingame_name: string;
  status: "ingame" | "online" | "offline";
  region: string;
  reputation: number;
  avatar: string | null;
  last_seen: string | null;
}

// ─── Profile auction (GET /v1/profile/:slug/auctions) — owner is string id ─────────────────
export interface WfmProfileAuctionEntry {
  id: string;
  owner: string;
  starting_price: number;
  buyout_price: number | null;
  visible: boolean;
  platform: string;
  closed: boolean;
  created: string;
  updated: string;
  is_direct_sell: boolean;
  item: WfmRivenAuctionItem;
}

export interface WfmProfileAuctionsPayload {
  auctions: WfmProfileAuctionEntry[];
}

// ─── Auction Entry ──────────────────────────────────────────────────
export interface WfmAuctionEntry {
  id: string;
  minimal_reputation: number;
  winner: string | null;
  private: boolean;
  visible: boolean;
  note_raw: string;
  note: string;
  owner: WfmAuctionOwner;
  starting_price: number;
  buyout_price: number | null;
  minimal_increment: number;
  is_direct_sell: boolean;
  top_bid: number | null;
  created: string;
  updated: string;
  platform: string;
  closed: boolean;
  is_marked_for: string | null;
  marked_operation_at: string | null;
  item: WfmRivenAuctionItem;
}

// ─── API Response Wrappers ──────────────────────────────────────────
export interface WfmApiResponse<T> {
  payload: T;
}

export interface WfmRivenItemsPayload {
  items: WfmRivenItem[];
}

export interface WfmRivenAttributesPayload {
  attributes: WfmRivenAttribute[];
}

export interface WfmAuctionsPayload {
  auctions: WfmAuctionEntry[];
}

// ─── Item Statistics (for investment / mod price by rank) ─────────────
export interface WfmStatisticsClosedEntry {
  datetime: string;
  volume: number;
  min_price: number;
  max_price: number;
  open_price?: number;
  closed_price?: number;
  avg_price: number;
  wa_price: number;
  median?: number;
  moving_avg?: number;
  donch_top?: number;
  donch_bot?: number;
  id: string;
  mod_rank: number;
}

export interface WfmStatisticsLiveEntry {
  datetime: string;
  volume: number;
  min_price: number;
  max_price: number;
  avg_price: number;
  wa_price: number;
  median?: number;
  order_type: string;
  id: string;
  mod_rank: number;
}

export interface WfmStatisticsPeriod {
  "48hours": WfmStatisticsClosedEntry[] | WfmStatisticsLiveEntry[];
  "90days": WfmStatisticsClosedEntry[] | WfmStatisticsLiveEntry[];
}

export interface WfmStatisticsPayload {
  statistics_closed?: {
    "48hours": WfmStatisticsClosedEntry[];
    "90days": WfmStatisticsClosedEntry[];
  };
  statistics_live?: {
    "48hours": WfmStatisticsLiveEntry[];
    "90days": WfmStatisticsLiveEntry[];
  };
}
