/**
 * Fetches WFM /items and checks which of our default investment mods are valid (tradable).
 * Run: node scripts/validate-investment-mods.mjs
 */

const WFM_ITEMS_URL = "https://api.warframe.market/v1/items";
const DEFAULT_MOD_LIST = [
  "primed_flow", "primed_continuity", "primed_vigor", "primed_redirection", "primed_vitality",
  "primed_pressure_point", "primed_fever_strike", "primed_reach", "primed_heavy_trauma",
  "primed_smite_corpus", "primed_smite_grineer", "primed_smite_infested",
  "serration", "split_chamber", "heavy_caliber", "point_strike", "vital_sense",
  "vigilante_armaments", "hells_chamber", "primed_cryo_rounds", "primed_infected_clip",
  "primed_stormbringer", "primed_shred", "primed_rifle_ammo_mutation", "primed_fast_hands",
  "high_voltage", "malignant_force", "thermite_rounds", "rime_rounds",
  "primed_point_blank", "primed_charged_shell", "primed_ravage", "primed_fulmination",
  "primed_shotgun_ammo_mutation", "blaze", "tactical_pump", "contagious_spread",
  "toxic_barrage", "frigid_blast", "shell_shock", "scattering_inferno",
  "hornet_strike", "barrel_diffusion", "lethal_torrent", "primed_pistol_gambit",
  "primed_target_cracker", "primed_heated_charge", "primed_convulsion", "primed_pathogen_rounds",
  "primed_slip_magazine", "primed_quickdraw", "primed_pistol_ammo_mutation",
  "jolt", "scorch", "frostbite", "pistol_pestilence", "convulsion", "pathogen_rounds",
  "heated_charge", "deep_freeze", "infected_clip", "stormbringer", "cryo_rounds",
  "pressure_point", "reach", "fury", "berserker", "organ_shatter", "true_steel",
  "spoiled_strike", "fever_strike", "north_wind", "shocking_touch", "molten_impact",
  "virulent_scourge", "volcanic_edge", "voltaic_strike", "vicious_frost",
  "primed_bane_of_corpus", "primed_bane_of_grineer", "primed_bane_of_infested",
  "collision_force", "sundering_strike", "shattering_impact",
  "vigilante_fervor", "vigilante_vengeance", "vigilante_supplies",
  "gladiator_might", "gladiator_vice", "gladiator_rush", "gladiator_resolve",
  "gladiator_aptitude", "gladiator_finesse",
  "hunter_munitions", "hunter_track", "hunter_adrenaline", "hunter_synergy",
  "hunter_recovery", "hunter_command", "hunter_instinct",
  "augur_message", "augur_reach", "augur_secrets", "augur_pact", "augur_accord",
  "stretch", "intensify", "streamline", "continuity", "flow", "vitality",
  "redirection", "steel_fiber", "animal_instinct", "fetch", "primed_animal_instinct",
  "primed_regen", "link_armor", "link_health", "link_shields", "maul", "bite",
  "savagery", "hunt", "pack_leader", "loyal_companion", "accelerated_blast",
  "ravage", "blunderbuss", "ammo_stock", "fatal_acceleration", "seeking_force",
  "tainted_shell", "chilling_reload", "critical_delay", "hammer_shot", "vile_acceleration",
  "metal_auger", "shred", "speed_trigger", "wildfire", "rifle_ammo_mutation",
  "fast_hands", "stunning_speed", "steady_hands", "target_cracker", "pistol_gambit",
  "gunslinger", "hollow_point", "creeping_bullseye", "anemic_agility", "pistol_ammo_mutation",
  "quickdraw", "slip_magazine", "lethal_momentum", "ice_storm", "trick_mag", "seeker",
  "stabilizer", "no_return", "razor_shot", "point_blank", "charged_shell", "flechette",
  "incendiary_coat", "chilling_grasp", "disruptor", "sawtooth_claw", "rending_turn",
  "dual_rounds", "eject_magazine", "archwing_weapon_ammo_mutation",
  "archon_continuity", "archon_flow", "archon_intensify", "archon_stretch", "archon_vitality",
  "galvanized_chamber", "galvanized_aptitude", "galvanized_scope", "galvanized_hell",
  "galvanized_savvy", "galvanized_acceleration", "galvanized_diffusion", "galvanized_crosshairs",
  "galvanized_shot", "galvanized_steel", "galvanized_reflex", "galvanized_elementalist",
];

async function main() {
  const res = await fetch(WFM_ITEMS_URL, {
    headers: { Platform: "pc", Language: "en", Accept: "application/json" },
  });
  if (!res.ok) {
    console.error("WFM API error:", res.status, await res.text());
    process.exit(1);
  }
  const data = await res.json();
  const items = data?.payload?.items;
  if (!Array.isArray(items)) {
    console.error("Unexpected response: no payload.items array");
    process.exit(1);
  }
  const validUrlNames = new Set(items.map((i) => i.url_name));
  const invalid = DEFAULT_MOD_LIST.filter((url) => !validUrlNames.has(url));
  const valid = DEFAULT_MOD_LIST.filter((url) => validUrlNames.has(url));
  console.log("Total in list:", DEFAULT_MOD_LIST.length);
  console.log("Valid (on WFM):", valid.length);
  console.log("Invalid (not on WFM / not tradable):", invalid.length);
  if (invalid.length > 0) {
    console.log("\nInvalid mods to remove:", invalid.join(", "));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
