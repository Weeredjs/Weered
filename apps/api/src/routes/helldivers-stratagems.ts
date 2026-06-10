import type { FastifyInstance } from "fastify";

type Stratagem = {
  slug: string;
  name: string;
  code: string;
  category: string;
  usageType: string;
  cooldown: number;
  uses: number;
  unlockLevel: number;
  description: string;
};

const STRATAGEMS: Stratagem[] = [
  { slug: "reinforce", name: "Reinforce", code: "↑↓→←↑", category: "Mission", usageType: "Mission", cooldown: 0, uses: -1, unlockLevel: 0, description: "Drop a fresh Helldiver from orbit. The backbone of every operation — reinforcements are the only way the squad stays alive." },
  { slug: "sos-beacon", name: "SOS Beacon", code: "↑↓→↑", category: "Mission", usageType: "Mission", cooldown: 0, uses: -1, unlockLevel: 0, description: "Deploy a beacon that requests reinforcement from any nearby Helldivers in the galaxy." },
  { slug: "resupply", name: "Resupply", code: "↓↓↑→", category: "Mission", usageType: "Supply", cooldown: 180, uses: -1, unlockLevel: 0, description: "Drop a resupply pod with ammo, grenades, and stims for the whole squad." },
  { slug: "hellbomb", name: "Hellbomb", code: "↓↑←↓↑→↓↑", category: "Mission", usageType: "Mission", cooldown: 0, uses: -1, unlockLevel: 0, description: "Mission-critical demolition device. Manually armed, 30s timer, levels everything inside the blast radius." },
  { slug: "seismic-probe", name: "Seismic Probe", code: "↑↑←→↓↓", category: "Mission", usageType: "Mission", cooldown: 0, uses: -1, unlockLevel: 0, description: "Mission-specific seismic survey device. Calls in a probe that must be defended while it scans." },
  { slug: "upload-data", name: "Upload Data", code: "←→↑↑↑", category: "Mission", usageType: "Mission", cooldown: 0, uses: -1, unlockLevel: 0, description: "Initiates a data upload at a designated terminal. Mission-specific objective." },

  { slug: "eagle-strafing-run", name: "Eagle Strafing Run", code: "↑→→", category: "Eagle", usageType: "Offensive", cooldown: 8, uses: 3, unlockLevel: 2, description: "Eagle-1 makes a low strafing pass with autocannon fire. Quick to deploy, devastating to light enemies in a line." },
  { slug: "eagle-airstrike", name: "Eagle Airstrike", code: "↑→↓→", category: "Eagle", usageType: "Offensive", cooldown: 8, uses: 2, unlockLevel: 4, description: "Eagle-1 drops a stick of bombs across a designated line. The all-purpose airstrike for clearing groups and fortifications." },
  { slug: "eagle-cluster-bomb", name: "Eagle Cluster Bomb", code: "↑→↓↓→", category: "Eagle", usageType: "Offensive", cooldown: 8, uses: 4, unlockLevel: 6, description: "Eagle-1 drops cluster munitions over a wide area. Excellent for scattered light enemies, terrible for friendly Helldivers." },
  { slug: "eagle-napalm-airstrike", name: "Eagle Napalm Airstrike", code: "↑→↓↑", category: "Eagle", usageType: "Offensive", cooldown: 8, uses: 2, unlockLevel: 11, description: "Eagle-1 lays down a napalm strike that creates a long-burning fire wall. Ideal against Terminid breaches." },
  { slug: "eagle-smoke-strike", name: "Eagle Smoke Strike", code: "↑→↑↓", category: "Eagle", usageType: "Defensive", cooldown: 8, uses: 4, unlockLevel: 17, description: "Eagle-1 deploys smoke canisters to obscure line of sight. Useful for cover during extraction or repositioning." },
  { slug: "eagle-110mm-rocket-pods", name: "Eagle 110MM Rocket Pods", code: "↑→↑←", category: "Eagle", usageType: "Offensive", cooldown: 8, uses: 3, unlockLevel: 13, description: "Eagle-1 fires a salvo of guided 110mm rockets at a designated target. Strong against single armored targets." },
  { slug: "eagle-500kg-bomb", name: "Eagle 500KG Bomb", code: "↑→↓↓↓", category: "Eagle", usageType: "Offensive", cooldown: 8, uses: 1, unlockLevel: 15, description: "Eagle-1 drops a single colossal 500kg bomb. The signature payload — small blast radius, massive damage at the epicenter." },

  { slug: "orbital-precision-strike", name: "Orbital Precision Strike", code: "→→↑", category: "Orbital", usageType: "Offensive", cooldown: 100, uses: -1, unlockLevel: 0, description: "A single high-velocity tungsten round dropped from orbit. The starter orbital — accurate and reliable against single targets." },
  { slug: "orbital-gatling-barrage", name: "Orbital Gatling Barrage", code: "→↓←↑↑", category: "Orbital", usageType: "Offensive", cooldown: 80, uses: -1, unlockLevel: 2, description: "Sustained autocannon fire from orbit over a small area. Great anti-infantry, modest cooldown." },
  { slug: "orbital-airburst-strike", name: "Orbital Airburst Strike", code: "→→→", category: "Orbital", usageType: "Offensive", cooldown: 120, uses: -1, unlockLevel: 4, description: "Three airburst rounds detonate above the target zone, raining shrapnel. Ideal against tightly packed light infantry." },
  { slug: "orbital-120mm-he-barrage", name: "Orbital 120MM HE Barrage", code: "→→↓←→↓", category: "Orbital", usageType: "Offensive", cooldown: 240, uses: -1, unlockLevel: 6, description: "A sustained 120mm high-explosive bombardment. Long cooldown, massive area-denial value." },
  { slug: "orbital-380mm-he-barrage", name: "Orbital 380MM HE Barrage", code: "→↓↑↑←↓↓", category: "Orbital", usageType: "Offensive", cooldown: 240, uses: -1, unlockLevel: 9, description: "The largest non-nuclear orbital bombardment. Wide spread, long duration. Watch your step." },
  { slug: "orbital-walking-barrage", name: "Orbital Walking Barrage", code: "→↓→↓→↓", category: "Orbital", usageType: "Offensive", cooldown: 240, uses: -1, unlockLevel: 11, description: "A rolling barrage that advances forward from the impact line. Perfect for sweeping through dense bug breaches." },
  { slug: "orbital-laser", name: "Orbital Laser", code: "→↓↑→↓", category: "Orbital", usageType: "Offensive", cooldown: 240, uses: 3, unlockLevel: 13, description: "A sustained orbital laser that prioritizes the largest threats first. Limited uses, but it deletes Bile Titans and Hulks." },
  { slug: "orbital-railcannon-strike", name: "Orbital Railcannon Strike", code: "→↑↓↓→", category: "Orbital", usageType: "Offensive", cooldown: 210, uses: -1, unlockLevel: 15, description: "A single high-energy rail round fired at the largest detected target. Reliable Charger and Hulk killer." },
  { slug: "orbital-gas-strike", name: "Orbital Gas Strike", code: "→→↓→", category: "Orbital", usageType: "Offensive", cooldown: 75, uses: -1, unlockLevel: 8, description: "Drops a canister of acidic gas that lingers and damages anything inside. Cheap and effective area control." },
  { slug: "orbital-ems-strike", name: "Orbital EMS Strike", code: "→→←↓", category: "Orbital", usageType: "Defensive", cooldown: 75, uses: -1, unlockLevel: 5, description: "An EMP burst that stuns enemies in the impact zone. Doesn't damage but buys precious seconds." },
  { slug: "orbital-smoke-strike", name: "Orbital Smoke Strike", code: "→→↓↑", category: "Orbital", usageType: "Defensive", cooldown: 100, uses: -1, unlockLevel: 5, description: "Deploys smoke from orbit to obscure line of sight across a wide area." },

  { slug: "machine-gun-sentry", name: "A/MG-43 Machine Gun Sentry", code: "↓↑→→↑", category: "Defensive", usageType: "Defensive", cooldown: 180, uses: -1, unlockLevel: 2, description: "An automated sentry that lays down medium-machine-gun fire on detected hostiles. The starter turret." },
  { slug: "gatling-sentry", name: "A/GL-18 Gatling Sentry", code: "↓↑→←", category: "Defensive", usageType: "Defensive", cooldown: 180, uses: -1, unlockLevel: 5, description: "Higher rate of fire than the MG sentry, shorter ammo supply. Shreds Terminid swarms." },
  { slug: "mortar-sentry", name: "A/M-12 Mortar Sentry", code: "↓↑→→↓", category: "Defensive", usageType: "Defensive", cooldown: 180, uses: -1, unlockLevel: 9, description: "Indirect-fire sentry that lobs explosive rounds at distant targets. Will absolutely kill the squad if used carelessly." },
  { slug: "autocannon-sentry", name: "A/AC-8 Autocannon Sentry", code: "↓↑→↑←↑", category: "Defensive", usageType: "Defensive", cooldown: 180, uses: -1, unlockLevel: 14, description: "Heavy autocannon sentry with armor-penetrating rounds. Effective against medium and light armor." },
  { slug: "rocket-sentry", name: "A/RX-34 Rocket Sentry", code: "↓↑→→←", category: "Defensive", usageType: "Defensive", cooldown: 180, uses: -1, unlockLevel: 19, description: "Anti-armor rocket sentry. Slow rate of fire but devastating against Chargers and Hulks." },
  { slug: "ems-mortar-sentry", name: "A/M-23 EMS Mortar Sentry", code: "↓↑→↓→", category: "Defensive", usageType: "Defensive", cooldown: 180, uses: -1, unlockLevel: 7, description: "Mortar sentry firing EMS rounds — stuns instead of kills. Excellent crowd control." },
  { slug: "anti-personnel-minefield", name: "Anti-Personnel Minefield", code: "↓←↑→", category: "Defensive", usageType: "Defensive", cooldown: 120, uses: -1, unlockLevel: 4, description: "Scatters anti-personnel mines across an area. Will detonate on light enemies and Helldivers alike." },
  { slug: "incendiary-mines", name: "Incendiary Mines", code: "↓←←↓", category: "Defensive", usageType: "Defensive", cooldown: 120, uses: -1, unlockLevel: 6, description: "Scatters incendiary mines that ignite anything that triggers them. Strong against bug breaches." },
  { slug: "shield-generator-relay", name: "Shield Generator Relay", code: "↓↓←→←→", category: "Defensive", usageType: "Defensive", cooldown: 240, uses: -1, unlockLevel: 12, description: "Deploys a stationary shield bubble that blocks projectiles. Ideal for objective defense." },
  { slug: "tesla-tower", name: "Tesla Tower", code: "↓↑→↑←→", category: "Defensive", usageType: "Defensive", cooldown: 240, uses: -1, unlockLevel: 16, description: "Stationary tesla coil that arcs lightning to nearby enemies. Will zap the squad — keep your distance." },
  { slug: "hmg-emplacement", name: "HMG Emplacement", code: "↓↑←→→←", category: "Defensive", usageType: "Defensive", cooldown: 180, uses: -1, unlockLevel: 8, description: "Manned heavy machine gun emplacement. Massive damage output but you're locked in place." },

  { slug: "machine-gun", name: "MG-43 Machine Gun", code: "↓←↓↑→", category: "Supply", usageType: "Supply", cooldown: 480, uses: -1, unlockLevel: 0, description: "Belt-fed medium machine gun. The bread-and-butter support weapon for Terminid sweeps." },
  { slug: "anti-materiel-rifle", name: "APW-1 Anti-Materiel Rifle", code: "↓←→↑↓", category: "Supply", usageType: "Supply", cooldown: 480, uses: -1, unlockLevel: 2, description: "Bolt-action high-velocity rifle. Pierces medium armor — ideal against Devastators and Brood Commanders." },
  { slug: "stalwart", name: "M-105 Stalwart", code: "↓←↓↑↑←", category: "Supply", usageType: "Supply", cooldown: 480, uses: -1, unlockLevel: 2, description: "Lightweight machine gun you can reload while moving. Higher rate of fire than the MG-43." },
  { slug: "expendable-anti-tank", name: "EAT-17 Expendable Anti-Tank", code: "↓↓←↑→", category: "Supply", usageType: "Supply", cooldown: 70, uses: -1, unlockLevel: 3, description: "A pair of disposable rocket launchers with short cooldown. Throw, fire, drop — perfect Charger killers." },
  { slug: "recoilless-rifle", name: "GR-8 Recoilless Rifle", code: "↓←→→←", category: "Supply", usageType: "Supply", cooldown: 480, uses: -1, unlockLevel: 5, description: "Heavy anti-tank rocket launcher. Requires a backpack of ammo — pair with a teammate for fastest reloads." },
  { slug: "flamethrower", name: "FLAM-40 Flamethrower", code: "↓←↑↓↑", category: "Supply", usageType: "Supply", cooldown: 480, uses: -1, unlockLevel: 8, description: "Sustained flame projector. Devastates Terminid swarms; less useful against Automatons." },
  { slug: "autocannon", name: "AC-8 Autocannon", code: "↓←↓↑↑→", category: "Supply", usageType: "Supply", cooldown: 480, uses: -1, unlockLevel: 10, description: "Versatile autocannon with armor-piercing capability. Backpack-fed. The all-rounder." },
  { slug: "railgun", name: "RS-422 Railgun", code: "↓→↓↑←→", category: "Supply", usageType: "Supply", cooldown: 480, uses: -1, unlockLevel: 20, description: "Single-shot electromagnetic rail weapon. Charge to penetrate the heaviest armor. Unsafe mode kills the user." },
  { slug: "spear", name: "FAF-14 Spear", code: "↓↓↑↓↓", category: "Supply", usageType: "Supply", cooldown: 480, uses: -1, unlockLevel: 20, description: "Lock-on guided anti-tank missile launcher. One-shots Bile Titans and Factory Striders. Locks are temperamental." },
  { slug: "grenade-launcher", name: "GL-21 Grenade Launcher", code: "↓←↑←↓", category: "Supply", usageType: "Supply", cooldown: 480, uses: -1, unlockLevel: 6, description: "Semi-auto grenade launcher. Great against bug holes and clusters of light troops." },
  { slug: "laser-cannon", name: "LAS-98 Laser Cannon", code: "↓←↓↑←", category: "Supply", usageType: "Supply", cooldown: 480, uses: -1, unlockLevel: 12, description: "Sustained beam weapon with infinite ammo (heat-limited). Strong against medium armor when held on weak points." },
  { slug: "arc-thrower", name: "ARC-3 Arc Thrower", code: "↓→↓↑←←", category: "Supply", usageType: "Supply", cooldown: 480, uses: -1, unlockLevel: 17, description: "Chain-lightning weapon with infinite ammo. Arcs between enemies; will arc to teammates if they're close." },
  { slug: "quasar-cannon", name: "LAS-99 Quasar Cannon", code: "↓↓↑←→", category: "Supply", usageType: "Supply", cooldown: 480, uses: -1, unlockLevel: 18, description: "Charge-up energy anti-tank weapon. Infinite ammo, long charge time per shot. The everyman's spear." },

  { slug: "guard-dog", name: "AX/LAS-5 Guard Dog (Rover)", code: "↓↑←↑→→", category: "Backpack", usageType: "Defensive", cooldown: 480, uses: -1, unlockLevel: 7, description: "An autonomous laser drone backpack that engages nearby light enemies. Don't forget it's there — it can shoot allies." },
  { slug: "guard-dog-bullet", name: "AX/AR-23 Guard Dog", code: "↓↑←↑→↓", category: "Backpack", usageType: "Defensive", cooldown: 480, uses: -1, unlockLevel: 10, description: "Ballistic version of the Guard Dog — ammo-fed, harder hitting than the laser version." },
  { slug: "shield-generator-pack", name: "SH-32 Shield Generator Pack", code: "↓↑→→←→", category: "Backpack", usageType: "Defensive", cooldown: 480, uses: -1, unlockLevel: 13, description: "Personal shield bubble backpack. Recharges over time. Lifesaver against Automaton ranged fire." },
  { slug: "supply-pack", name: "B-1 Supply Pack", code: "↓←↓↑↑↓", category: "Backpack", usageType: "Supply", cooldown: 480, uses: -1, unlockLevel: 4, description: "Carries four resupply packs that can be distributed to teammates. The medic's choice." },
  { slug: "ballistic-shield", name: "SH-20 Ballistic Shield Backpack", code: "↓←↓↓↑←", category: "Backpack", usageType: "Defensive", cooldown: 480, uses: -1, unlockLevel: 9, description: "A deployable ballistic shield carried on the back. Switch to one-handed sidearm to use it." },
  { slug: "jump-pack", name: "LIFT-850 Jump Pack", code: "↓↑↑↓↑", category: "Backpack", usageType: "Vehicle", cooldown: 480, uses: -1, unlockLevel: 8, description: "Single-charge jetpack that boosts the user upward. Cooldown between jumps. Don't aim into a wall." },

  { slug: "exosuit-emancipator", name: "EXO-49 Emancipator Exosuit", code: "↓←↓↑→→", category: "Mech", usageType: "Vehicle", cooldown: 600, uses: 2, unlockLevel: 25, description: "Twin-autocannon exosuit. Heavy armor, devastating firepower, no reload between drops." },
  { slug: "exosuit-patriot", name: "EXO-45 Patriot Exosuit", code: "↓←↓↑→↓", category: "Mech", usageType: "Vehicle", cooldown: 600, uses: 2, unlockLevel: 18, description: "Minigun + rocket-pod exosuit. The original Helldivers mech, balanced for general combat." },
];

const BY_SLUG = new Map<string, Stratagem>();
STRATAGEMS.forEach(s => BY_SLUG.set(s.slug, s));

const CATEGORIES = Array.from(new Set(STRATAGEMS.map(s => s.category)));

export default async function helldiversStratagemsRoutes(app: FastifyInstance) {
  app.get("/helldivers/stratagems", async (req, reply) => {
    const q: any = (req as any).query || {};
    const category = q.category ? String(q.category) : null;
    const usage = q.usage ? String(q.usage) : null;
    const maxLevel = q.maxLevel ? Number(q.maxLevel) : null;
    const search = q.search ? String(q.search).toLowerCase() : null;

    let list = STRATAGEMS.slice();
    if (category) list = list.filter(s => s.category.toLowerCase() === category.toLowerCase());
    if (usage)    list = list.filter(s => s.usageType.toLowerCase() === usage.toLowerCase());
    if (typeof maxLevel === "number" && !Number.isNaN(maxLevel)) list = list.filter(s => s.unlockLevel <= maxLevel);
    if (search)   list = list.filter(s =>
      s.name.toLowerCase().includes(search) ||
      s.description.toLowerCase().includes(search) ||
      s.category.toLowerCase().includes(search)
    );

    return reply.send({
      ok: true,
      count: list.length,
      total: STRATAGEMS.length,
      categories: CATEGORIES,
      stratagems: list,
    });
  });

  app.get("/helldivers/stratagems/:slug", async (req, reply) => {
    const slug = String((req as any).params?.slug || "").toLowerCase();
    const s = BY_SLUG.get(slug);
    if (!s) return reply.code(404).send({ ok: false, error: "stratagem_not_found" });
    return reply.send({ ok: true, stratagem: s });
  });
}
