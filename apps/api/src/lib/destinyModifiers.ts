
export type ModifierTab = "BOON" | "BUILDCRAFT" | "GAMEPLAY" | "CHALLENGE" | "RULE" | "TIER";
export type SlotKind = "PLAYER_PICK" | "ACTIVITY_LOCKED";

export type ModifierCategory = "BURN" | "SURGE" | "THREAT" | "RESTRICTION" | "DIFFICULTY" | "TIER";

export type ModifierEntry = {
  hash: string;
  slug: string;
  name: string;
  description: string;
  tab: ModifierTab;
  slotKind: SlotKind;
  rewardStars?: 1 | 2 | 3 | 4 | 5;
  icon: string;
  color?: string;
  category?: ModifierCategory;
};

function legacyCategory(tab: ModifierTab): ModifierCategory {
  switch (tab) {
    case "BOON":      return "SURGE";
    case "CHALLENGE": return "THREAT";
    case "GAMEPLAY":  return "RESTRICTION";
    case "RULE":      return "DIFFICULTY";
    case "BUILDCRAFT": return "RESTRICTION";
    case "TIER":      return "TIER";
  }
}

const RAW_MODIFIERS = [
  {
    hash: "426976067",
    slug: "solar-surge",
    name: "Solar Surge",
    description: "{var:2189146210}% bonus to outgoing Solar damage.",
    tab: "BOON",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "🌞",
    color: "#f97316"
  },
  {
    hash: "2691200658",
    slug: "arc-surge",
    name: "Arc Surge",
    description: "{var:2189146210}% bonus to outgoing Arc damage.",
    tab: "BOON",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "⚡",
    color: "#60a5fa"
  },
  {
    hash: "3196075844",
    slug: "void-surge",
    name: "Void Surge",
    description: "{var:2189146210}% bonus to outgoing Void damage.",
    tab: "BOON",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "🌑",
    color: "#a78bfa"
  },
  {
    hash: "3809788899",
    slug: "stasis-surge",
    name: "Stasis Surge",
    description: "{var:2189146210}% bonus to outgoing Stasis damage.",
    tab: "BOON",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "🧊",
    color: "#67e8f9"
  },
  {
    hash: "3810297122",
    slug: "strand-surge",
    name: "Strand Surge",
    description: "{var:2189146210}% bonus to outgoing Strand damage.",
    tab: "BOON",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "🟢",
    color: "#22c55e"
  },
  {
    hash: "1575279060",
    slug: "solar-thermal-swap",
    name: "Solar Thermal Swap",
    description: "Solar final blows grant melee and grenade energy. Stasis subclasses receive a lot; other subclasses receive a little.",
    tab: "BOON",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "♨️",
    color: "#f97316"
  },
  {
    hash: "2072906693",
    slug: "stasis-thermal-swap",
    name: "Stasis Thermal Swap",
    description: "Stasis final blows grant melee and grenade energy. Solar subclasses receive a lot; other subclasses receive a little.",
    tab: "BOON",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "❄️",
    color: "#67e8f9"
  },
  {
    hash: "3762220583",
    slug: "full-throttle",
    name: "Full Throttle",
    description: "Defeating targets without dying increases all outgoing damage.",
    tab: "BOON",
    slotKind: "PLAYER_PICK",
    rewardStars: 3,
    icon: "🏎️",
    color: "#22c55e"
  },
  {
    hash: "3787716856",
    slug: "daodan-surge",
    name: "Daodan Surge",
    description: "Melee abilities deal more damage and recharge much faster.",
    tab: "BOON",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "👊",
    color: "#f87171"
  },
  {
    hash: "2378419670",
    slug: "frontliner",
    name: "Frontliner",
    description: "Ability recharge rate is increased.",
    tab: "BOON",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "⚙️",
    color: "#22c55e"
  },
  {
    hash: "2742259563",
    slug: "surge-protector",
    name: "Surge Protector",
    description: "Super recharge rate is increased.",
    tab: "BOON",
    slotKind: "PLAYER_PICK",
    rewardStars: 1,
    icon: "🔋",
    color: "#a78bfa"
  },
  {
    hash: "2492586271",
    slug: "prism-day",
    name: "PRISM Day",
    description: "All collected Elemental Orbs contribute toward the elemental buff counter. Subclass choice determines which elemental buff is applied. Prismatic orbs from Taken combatants grant a random empowerment",
    tab: "BOON",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "🌈",
    color: "#fbbf24"
  },
  {
    hash: "3517267764",
    slug: "solar-threat",
    name: "Solar Threat",
    description: "{var:4005007457}% increase to incoming Solar damage.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 3,
    icon: "🔥",
    color: "#f97316"
  },
  {
    hash: "186409259",
    slug: "arc-threat",
    name: "Arc Threat",
    description: "{var:4005007457}% increase to incoming Arc damage.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 3,
    icon: "⚡",
    color: "#60a5fa"
  },
  {
    hash: "3652821947",
    slug: "void-threat",
    name: "Void Threat",
    description: "{var:4005007457}% increase to incoming Void damage.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 3,
    icon: "🟣",
    color: "#a78bfa"
  },
  {
    hash: "512042454",
    slug: "stasis-threat",
    name: "Stasis Threat",
    description: "{var:4005007457}% increase to incoming Stasis damage.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 3,
    icon: "❄️",
    color: "#67e8f9"
  },
  {
    hash: "1598472557",
    slug: "strand-threat",
    name: "Strand Threat",
    description: "{var:4005007457}% increase to incoming Strand damage.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 3,
    icon: "🟢",
    color: "#22c55e"
  },
  {
    hash: "2751349583",
    slug: "match-game",
    name: "Match Game",
    description: "Enemy shields are highly resistant to all unmatched elemental damage.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "🎯",
    color: "#fbbf24"
  },
  {
    hash: "1486810101",
    slug: "equipment-locked",
    name: "Equipment Locked",
    description: "You will not be able to change your equipment after this activity starts.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "🔐",
    color: "#94a3b8"
  },
  {
    hash: "3629079662",
    slug: "togetherness",
    name: "Togetherness",
    description: "Base health regen is reduced. If near another player, health regen is increased.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "🤝",
    color: "#60a5fa"
  },
  {
    hash: "2482824751",
    slug: "chill-touch",
    name: "Chill Touch",
    description: "Being hit by a melee attack slows you.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "🥶",
    color: "#67e8f9"
  },
  {
    hash: "1365610347",
    slug: "hot-step",
    name: "Hot Step",
    description: "When defeated, challenging combatants drop fire at their location.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "🔥",
    color: "#f97316"
  },
  {
    hash: "112345143",
    slug: "hot-knife",
    name: "Hot Knife",
    description: "Shanks now have Solar shields",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 3,
    icon: "🔪",
    color: "#ef4444"
  },
  {
    hash: "703904464",
    slug: "scorched-earth",
    name: "Scorched Earth",
    description: "Enemies throw grenades significantly more often.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "💣",
    color: "#f97316"
  },
  {
    hash: "941999846",
    slug: "galvanized",
    name: "Galvanized",
    description: "Combatants have more health and are more difficult to stun.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 3,
    icon: "🛡️",
    color: "#fbbf24"
  },
  {
    hash: "965929096",
    slug: "famine",
    name: "Famine",
    description: "All ammunition drops are significantly reduced.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 2,
    icon: "🍖",
    color: "#94a3b8"
  },
  {
    hash: "998275325",
    slug: "epitaph",
    name: "Epitaph",
    description: "Taken combatants generate blight geysers when defeated.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 4,
    icon: "💥",
    color: "#a78bfa"
  },
  {
    hash: "1463769380",
    slug: "iron",
    name: "Iron",
    description: "Enemies have more health and are not staggered by damage.",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 3,
    icon: "🪨",
    color: "#94a3b8"
  },
  {
    hash: "410878524",
    slug: "rage-and-healing",
    name: "Rage and Healing",
    description: "Banes Rage and Healing will appear on enemy combatants. Rage: Affected enemy combatants deal increased damage and have increased damage resistance as their health levels decline. Healing: Affected e",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 4,
    icon: "🩸",
    color: "#ef4444"
  },
  {
    hash: "468121195",
    slug: "protected-and-meteors",
    name: "Protected and Meteors",
    description: "Banes Protected and Meteors will appear on enemy combatants. Protected: Affected enemy combatants are invulnerable until you destroy the shield drones orbiting them. Meteors: Affected enemy combatan",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 4,
    icon: "🩸",
    color: "#ef4444"
  },
  {
    hash: "739936454",
    slug: "gravity-and-meteors",
    name: "Gravity and Meteors",
    description: "Banes Gravity and Meteors will appear on enemy combatants. Gravity: Affected enemy combatants fire Void projectiles that detonate into damaging Void fields. Meteors: Affected enemy combatants period",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 4,
    icon: "🩸",
    color: "#ef4444"
  },
  {
    hash: "874363817",
    slug: "gravity-and-shield",
    name: "Gravity and Shield",
    description: "Banes Gravity and Shield will appear on enemy combatants. Gravity: Affected enemy combatants fire Void projectiles that detonate into damaging Void fields. Shield: Affected enemy combatants have a f",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 4,
    icon: "🩸",
    color: "#ef4444"
  },
  {
    hash: "951858375",
    slug: "rage-and-meteors",
    name: "Rage and Meteors",
    description: "Banes Rage and Meteors will appear on enemy combatants. Rage: Affected enemy combatants deal increased damage and have increased damage resistance as their health levels decline. Meteors: Affected e",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 4,
    icon: "🩸",
    color: "#ef4444"
  },
  {
    hash: "963950168",
    slug: "protected-and-healing",
    name: "Protected and Healing",
    description: "Banes Protected and Healing will appear on enemy combatants. Protected: Affected enemy combatants are invulnerable until you destroy the shield drones orbiting them. Healing: Affected enemy combatan",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 5,
    icon: "🩸",
    color: "#ef4444"
  },
  {
    hash: "975464573",
    slug: "gravity-and-hypernova",
    name: "Gravity and Hypernova",
    description: "Banes Gravity and Hypernova will appear on enemy combatants. Gravity: Affected enemy combatants fire Void projectiles that detonate into damaging Void fields. Hypernova: Affected enemy combatants th",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 5,
    icon: "🩸",
    color: "#ef4444"
  },
  {
    hash: "1033382240",
    slug: "shield-and-meteors",
    name: "Shield and Meteors",
    description: "Banes Shield and Meteors will appear on enemy combatants. Shield: Affected enemy combatants have a forward-facing shield protecting them from damage. Try shooting them from behind. Meteors: Affected",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 4,
    icon: "🩸",
    color: "#ef4444"
  },
  {
    hash: "1303655893",
    slug: "rage-and-hypernova",
    name: "Rage and Hypernova",
    description: "Banes Rage and Hypernova will appear on enemy combatants. Rage: Affected enemy combatants deal increased damage and have increased damage resistance as their health levels decline. Hypernova: Affect",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 5,
    icon: "🩸",
    color: "#ef4444"
  },
  {
    hash: "2368554323",
    slug: "healing-and-hypernova",
    name: "Healing and Hypernova",
    description: "Banes Healing and Hypernova will appear on enemy combatants. Healing: Affected enemy combatants provide a buff to nearby allies based on shield type. Hypernova: Affected enemy combatants that have r",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 5,
    icon: "🩸",
    color: "#ef4444"
  },
  {
    hash: "3332446153",
    slug: "protected-and-hypernova",
    name: "Protected and Hypernova",
    description: "Banes Protected and Hypernova will appear on enemy combatants. Protected: Affected enemy combatants are invulnerable until you destroy the shield drones orbiting them. Hypernova: Affected enemy comb",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 5,
    icon: "🩸",
    color: "#ef4444"
  },
  {
    hash: "3499773572",
    slug: "gravity-and-healing",
    name: "Gravity and Healing",
    description: "Banes Gravity and Healing will appear on enemy combatants. Gravity: Affected enemy combatants fire Void projectiles that detonate into damaging Void fields. Healing: Affected enemy combatants provid",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 4,
    icon: "🩸",
    color: "#ef4444"
  },
  {
    hash: "3820155910",
    slug: "rage-and-shield",
    name: "Rage and Shield",
    description: "Banes Rage and Meteors will appear on enemy combatants. Rage: Affected enemy combatants deal increased damage and have increased damage resistance as their health levels decline. Meteors: Affected e",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 4,
    icon: "🩸",
    color: "#ef4444"
  },
  {
    hash: "4067953666",
    slug: "protected-and-shield",
    name: "Protected and Shield",
    description: "Banes Protected and Shield will appear on enemy combatants. Protected: Affected enemy combatants are invulnerable until you destroy the shield drones orbiting them. Shield: Affected enemy combatants",
    tab: "CHALLENGE",
    slotKind: "PLAYER_PICK",
    rewardStars: 5,
    icon: "🩸",
    color: "#ef4444"
  },
  {
    hash: "4239965093",
    slug: "limited-revives",
    name: "Limited Revives",
    description: "Limited fireteam revives. Gain additional revives by defeating Champions.",
    tab: "GAMEPLAY",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "💔",
    color: "#ef4444"
  },
  {
    hash: "1974619026",
    slug: "champions-barrier",
    name: "Champions: Barrier",
    description: "This mode contains Barrier Champions, which cannot be stopped without an Anti-Barrier mod.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "🛡️",
    color: "#fbbf24"
  },
  {
    hash: "1201462052",
    slug: "champions-overload",
    name: "Champions: Overload",
    description: "This mode contains Overload Champions, which cannot be stopped without an Overload mod.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "🔄",
    color: "#a78bfa"
  },
  {
    hash: "40182179",
    slug: "champion-foes-40182179",
    name: "Champion Foes ([Disruption] Overload and [Stagger] Unstoppable Champions)",
    description: "You will face [Disruption] Overload and [Stagger] Unstoppable Champions.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#ef4444"
  },
  {
    hash: "197794292",
    slug: "champion-foes-197794292",
    name: "Champion Foes ([Shield-Piercing] Barrier and [Disruption] Overload Champion)",
    description: "You will face [Shield-Piercing] Barrier and [Disruption] Overload Champions.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#ef4444"
  },
  {
    hash: "438106166",
    slug: "champion-foes-438106166",
    name: "Champion Foes ([Shield-Piercing] Barrier and [Stagger] Unstoppable Champion)",
    description: "You will face [Shield-Piercing] Barrier and [Stagger] Unstoppable Champions. Visit the Character or Mod Customization screen to view your active anti-Champion perks.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#ef4444"
  },
  {
    hash: "1262171714",
    slug: "champion-foes-1262171714",
    name: "Champion Foes ([Disruption] Overload Champions)",
    description: "You will face [Disruption] Overload Champions. Visit the Character or Mod Customization screen to view your active anti-Champion perks.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#ef4444"
  },
  {
    hash: "1598783516",
    slug: "champion-foes-1598783516",
    name: "Champion Foes ([Stagger] Unstoppable Champions)",
    description: "You will face [Stagger] Unstoppable Champions.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#ef4444"
  },
  {
    hash: "1615778293",
    slug: "champion-foes-1615778293",
    name: "Champion Foes ([Shield-Piercing] Barrier Champions)",
    description: "You will face [Shield-Piercing] Barrier Champions.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#ef4444"
  },
  {
    hash: "1806568190",
    slug: "champion-foes-1806568190",
    name: "Champion Foes ([Shield-Piercing] Barrier and [Stagger] Unstoppable Champion)",
    description: "You will face [Shield-Piercing] Barrier and [Stagger] Unstoppable Champions.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#ef4444"
  },
  {
    hash: "1990363418",
    slug: "champion-foes-1990363418",
    name: "Champion Foes ([Shield-Piercing] Barrier and [Disruption] Overload Champion)",
    description: "You will face [Shield-Piercing] Barrier and [Disruption] Overload Champions. Visit the Character or Mod Customization screen to view your active anti-Champion perks.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#ef4444"
  },
  {
    hash: "2006149364",
    slug: "champion-foes-2006149364",
    name: "Champion Foes ([Shield-Piercing] Barrier, [Disruption] Overload, and [Stagg)",
    description: "You will face [Shield-Piercing] Barrier, [Disruption] Overload, and [Stagger] Unstoppable Champions. Visit the Character or Mod Customization screen to view your active anti-Champion perks.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#ef4444"
  },
  {
    hash: "2475764450",
    slug: "champion-foes-2475764450",
    name: "Champion Foes ([Stagger] Unstoppable Champions)",
    description: "You will face [Stagger] Unstoppable Champions. Visit the Character or Mod Customization screen to view your active anti-Champion perks.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#ef4444"
  },
  {
    hash: "3307318061",
    slug: "champion-foes-3307318061",
    name: "Champion Foes ([Disruption] Overload and [Stagger] Unstoppable Champions)",
    description: "You will face [Disruption] Overload and [Stagger] Unstoppable Champions. Visit the Character or Mod Customization screen to view your active anti-Champion perks.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#ef4444"
  },
  {
    hash: "3461252634",
    slug: "champion-foes-3461252634",
    name: "Champion Foes ([Disruption] Overload Champions)",
    description: "You will face [Disruption] Overload Champions.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#ef4444"
  },
  {
    hash: "4038464106",
    slug: "champion-foes-4038464106",
    name: "Champion Foes ([Shield-Piercing] Barrier, [Disruption] Overload, and [Stagg)",
    description: "You will face [Shield-Piercing] Barrier, [Disruption] Overload, and [Stagger] Unstoppable Champions.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#ef4444"
  },
  {
    hash: "4190795159",
    slug: "champion-foes-4190795159",
    name: "Champion Foes ([Shield-Piercing] Barrier Champions)",
    description: "You will face [Shield-Piercing] Barrier Champions. Visit the Character or Mod Customization screen to view your active anti-Champion perks.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#ef4444"
  },
  {
    hash: "1282934989",
    slug: "overcharged-sniper-rifle",
    name: "Overcharged Sniper Rifle",
    description: "{var:1027206613}% bonus to Sniper Rifle damage.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "🎯",
    color: "#fbbf24"
  },
  {
    hash: "2178457119",
    slug: "overcharged-trace-rifle",
    name: "Overcharged Trace Rifle",
    description: "{var:1027206613}% bonus to Trace Rifle damage.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "🔫",
    color: "#fbbf24"
  },
  {
    hash: "95459596",
    slug: "overcharged-rocket-launcher",
    name: "Overcharged Rocket Launcher",
    description: "{var:1027206613}% bonus to Rocket Launcher damage.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "🚀",
    color: "#fbbf24"
  },
  {
    hash: "2626834038",
    slug: "overcharged-fusion-rifle",
    name: "Overcharged Fusion Rifle",
    description: "{var:1027206613}% bonus to Fusion Rifle damage.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "💥",
    color: "#fbbf24"
  },
  {
    hash: "795009574",
    slug: "overcharged-machine-gun",
    name: "Overcharged Machine Gun",
    description: "{var:1027206613}% bonus to Machine Gun damage.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚙️",
    color: "#fbbf24"
  },
  {
    hash: "1326581064",
    slug: "overcharged-sword",
    name: "Overcharged Sword",
    description: "{var:1027206613}% bonus to Sword damage.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "⚔️",
    color: "#fbbf24"
  },
  {
    hash: "2743796883",
    slug: "overcharged-glaive",
    name: "Overcharged Glaive",
    description: "{var:1027206613}% bonus to Glaive damage.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "🔱",
    color: "#fbbf24"
  },
  {
    hash: "3132780533",
    slug: "overcharged-shotgun",
    name: "Overcharged Shotgun",
    description: "{var:1027206613}% bonus to Shotgun damage.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "💣",
    color: "#fbbf24"
  },
  {
    hash: "3320777106",
    slug: "overcharged-linear-fusion-rifle",
    name: "Overcharged Linear Fusion Rifle",
    description: "{var:1027206613}% bonus to Linear Fusion Rifle damage.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "🔆",
    color: "#fbbf24"
  },
  {
    hash: "3758645512",
    slug: "overcharged-grenade-launcher",
    name: "Overcharged Grenade Launcher",
    description: "{var:1027206613}% bonus to damage for all Grenade Launchers.",
    tab: "RULE",
    slotKind: "ACTIVITY_LOCKED",
    rewardStars: 2,
    icon: "💣",
    color: "#fbbf24"
  },
  {
    hash: "tier:normal",
    slug: "tier-normal",
    name: "Normal",
    description: "Standard activity difficulty (+10)",
    icon: "🟢",
    color: "#22c55e",
    tab: "TIER",
    slotKind: "PLAYER_PICK"
  },
  {
    hash: "tier:advanced",
    slug: "tier-advanced",
    name: "Advanced",
    description: "Slight challenge bump (+100)",
    icon: "🟡",
    color: "#fbbf24",
    tab: "TIER",
    slotKind: "PLAYER_PICK"
  },
  {
    hash: "tier:expert",
    slug: "tier-expert",
    name: "Expert",
    description: "Hero-equivalent power requirement (+200)",
    icon: "🟠",
    color: "#f97316",
    tab: "TIER",
    slotKind: "PLAYER_PICK"
  },
  {
    hash: "tier:master",
    slug: "tier-master",
    name: "Master",
    description: "Pinnacle difficulty (+300)",
    icon: "🔴",
    color: "#ef4444",
    tab: "TIER",
    slotKind: "PLAYER_PICK"
  },
  {
    hash: "tier:grandmaster",
    slug: "tier-grandmaster",
    name: "Grandmaster",
    description: "Locked loadout + extra champions (+400)",
    icon: "🟣",
    color: "#a78bfa",
    tab: "TIER",
    slotKind: "PLAYER_PICK"
  },
  {
    hash: "tier:ultimate",
    slug: "tier-ultimate",
    name: "Ultimate",
    description: "Maximum difficulty (+500)",
    icon: "⚫",
    color: "#000000",
    tab: "TIER",
    slotKind: "PLAYER_PICK"
  }
];

export const DESTINY_MODIFIERS: ModifierEntry[] = RAW_MODIFIERS.map((m: any) => ({
  ...m,
  category: legacyCategory(m.tab),
}));

export const TABS: { key: ModifierTab; label: string; description: string; slots?: number }[] = [
  { key: "TIER",       label: "Difficulty",         description: "Activity power tier — Normal through Ultimate" },
  { key: "BOON",       label: "Boons",              description: "Player buffs — pick up to 3 in Custom Ops",            slots: 3 },
  { key: "CHALLENGE",  label: "Challenge Modifiers", description: "Banes, threats, debuffs — pick 5 in Custom Ops",       slots: 5 },
  { key: "BUILDCRAFT", label: "Buildcraft Stakes",  description: "Loadout/buildcraft restrictions — partly player-set" },
  { key: "GAMEPLAY",   label: "Gameplay Stakes",    description: "Revives, timers, rewards — mostly Bungie-set" },
  { key: "RULE",       label: "Rule Modifiers",     description: "Bungie-locked: Champions and core activity rules" },
];
