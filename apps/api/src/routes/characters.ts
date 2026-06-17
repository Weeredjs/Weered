import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  getGlobalRole: (userId: string) => Promise<string>;
  canAccessStaff: (role: any) => boolean;
};

function abilityMod(score: number): number {
  const n = Number.isFinite(score) ? score : 10;
  return Math.floor((n - 10) / 2);
}

function proficiencyBonus(level: number): number {
  const lv = Math.max(1, Math.min(20, Math.floor(Number(level) || 1)));
  if (lv >= 17) return 6;
  if (lv >= 13) return 5;
  if (lv >= 9) return 4;
  if (lv >= 5) return 3;
  return 2;
}

const ABILITY_KEYS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const;
type AbilityKey = (typeof ABILITY_KEYS)[number];

const SKILL_ABILITY: Record<string, AbilityKey> = {
  acrobatics: "DEX",
  animalHandling: "WIS",
  arcana: "INT",
  athletics: "STR",
  deception: "CHA",
  history: "INT",
  insight: "WIS",
  intimidation: "CHA",
  investigation: "INT",
  medicine: "WIS",
  nature: "INT",
  perception: "WIS",
  performance: "CHA",
  persuasion: "CHA",
  religion: "INT",
  sleightOfHand: "DEX",
  stealth: "DEX",
  survival: "WIS",
};

function abilityScore(c: any, k: AbilityKey): number {
  switch (k) {
    case "STR":
      return c.str;
    case "DEX":
      return c.dex;
    case "CON":
      return c.con;
    case "INT":
      return c.int;
    case "WIS":
      return c.wis;
    case "CHA":
      return c.cha;
  }
}

function withDerived(c: any) {
  const pb = proficiencyBonus(c.level);
  const mods: Record<AbilityKey, number> = {} as any;
  for (const k of ABILITY_KEYS) mods[k] = abilityMod(abilityScore(c, k));

  const saveProfs: string[] = Array.isArray(c.saveProfs) ? c.saveProfs : [];
  const saves = ABILITY_KEYS.map((k) => ({
    ability: k,
    proficient: saveProfs.includes(k),
    bonus: mods[k] + (saveProfs.includes(k) ? pb : 0),
  }));

  const skillProfs: Array<{ skill: string; expertise?: boolean }> = Array.isArray(c.skillProfs)
    ? c.skillProfs
    : [];
  const profMap = new Map(skillProfs.map((s) => [s.skill, !!s.expertise]));
  const skills = Object.keys(SKILL_ABILITY).map((skill) => {
    const ability = SKILL_ABILITY[skill];
    const proficient = profMap.has(skill);
    const expertise = profMap.get(skill) === true;
    const bonus = mods[ability] + (proficient ? pb : 0) + (expertise ? pb : 0);
    return { skill, ability, proficient, expertise, bonus };
  });

  return {
    ...c,
    derived: {
      proficiencyBonus: pb,
      mods,
      saves,
      skills,
      passivePerception: 10 + (skills.find((s) => s.skill === "perception")?.bonus ?? mods.WIS),
      initiative: mods.DEX,
    },
  };
}

async function isDMForCharacter(
  userId: string,
  c: { roomId: string | null; ownerUserId: string },
  getGlobalRole: Opts["getGlobalRole"],
  canAccessStaff: Opts["canAccessStaff"],
): Promise<boolean> {
  if (!c.roomId) return false;
  const role = await getGlobalRole(userId);
  if (canAccessStaff(role)) return true;
  const room = await prisma.room.findUnique({ where: { id: c.roomId }, select: { ownerId: true } });
  return !!room && room.ownerId === userId;
}

export default async function characterRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, getGlobalRole, canAccessStaff } = opts;

  app.post("/characters", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const b: any = (req as any).body || {};
    const name = String(b.name || "")
      .trim()
      .slice(0, 80);
    if (!name) return reply.code(400).send({ ok: false, error: "name_required" });

    const data: any = {
      name,
      ownerUserId: u.id,
      className: String(b.className || "").slice(0, 40),
      level: Math.max(1, Math.min(20, parseInt(b.level) || 1)),
      race: String(b.race || "").slice(0, 40),
      alignment: String(b.alignment || "").slice(0, 40),
      campaignId: b.campaignId ? String(b.campaignId) : null,
      roomId: b.roomId ? String(b.roomId) : null,
      str: clampScore(b.str),
      dex: clampScore(b.dex),
      con: clampScore(b.con),
      int: clampScore(b.int),
      wis: clampScore(b.wis),
      cha: clampScore(b.cha),
      hpCurrent: clampInt(b.hpCurrent, 0, 999, 0),
      hpMax: clampInt(b.hpMax, 0, 999, 0),
      hpTemp: clampInt(b.hpTemp, 0, 999, 0),
      ac: clampInt(b.ac, 0, 50, 10),
      speed: clampInt(b.speed, 0, 200, 30),
      hitDice: String(b.hitDice || "").slice(0, 40),
      saveProfs: sanitizeSaveProfs(b.saveProfs),
      skillProfs: sanitizeSkillProfs(b.skillProfs),
      spellSlots: sanitizeSpellSlots(b.spellSlots),
      spells: sanitizeSpells(b.spells),
      inventory: sanitizeInventory(b.inventory),
      cp: clampInt(b.cp, 0, 1_000_000, 0),
      sp: clampInt(b.sp, 0, 1_000_000, 0),
      ep: clampInt(b.ep, 0, 1_000_000, 0),
      gp: clampInt(b.gp, 0, 1_000_000, 0),
      pp: clampInt(b.pp, 0, 1_000_000, 0),
      features: sanitizeFeatures(b.features),
      attacks: sanitizeAttacks(b.attacks),
      notesDM: String(b.notesDM || "").slice(0, 8000),
      notesPlayer: String(b.notesPlayer || "").slice(0, 8000),
      notesParty: String(b.notesParty || "").slice(0, 8000),
    };

    const c = await prisma.character.create({ data });
    return reply.send({ ok: true, character: withDerived(c) });
  });

  app.get("/characters", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const q: any = (req as any).query || {};
    const roomId = q.roomId ? String(q.roomId) : null;
    const mineOnly = q.mine === "1" || q.mine === "true";

    if (roomId && !mineOnly) {
      const role = await getGlobalRole(u.id);
      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { ownerId: true },
      });
      const isDM = canAccessStaff(role) || room?.ownerId === u.id;
      if (isDM) {
        const chars = await prisma.character.findMany({
          where: { roomId },
          orderBy: [{ name: "asc" }],
        });
        return reply.send({ ok: true, characters: chars.map(withDerived), asDM: true });
      }
      const chars = await prisma.character.findMany({
        where: { roomId, ownerUserId: u.id },
        orderBy: [{ name: "asc" }],
      });
      return reply.send({ ok: true, characters: chars.map(withDerived), asDM: false });
    }

    const chars = await prisma.character.findMany({
      where: { ownerUserId: u.id },
      orderBy: [{ updatedAt: "desc" }],
    });
    return reply.send({ ok: true, characters: chars.map(withDerived), asDM: false });
  });

  app.get("/characters/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const id = String((req as any).params?.id || "");
    const c = await prisma.character.findUnique({ where: { id } });
    if (!c) return reply.code(404).send({ ok: false, error: "not_found" });

    if (c.ownerUserId !== u.id) {
      const dm = await isDMForCharacter(u.id, c, getGlobalRole, canAccessStaff);
      if (!dm) return reply.code(403).send({ ok: false, error: "forbidden" });
    }
    return reply.send({ ok: true, character: withDerived(c) });
  });

  app.patch("/characters/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });

    const id = String((req as any).params?.id || "");
    const c = await prisma.character.findUnique({ where: { id } });
    if (!c) return reply.code(404).send({ ok: false, error: "not_found" });

    const isOwner = c.ownerUserId === u.id;
    const dm = isOwner ? false : await isDMForCharacter(u.id, c, getGlobalRole, canAccessStaff);
    if (!isOwner && !dm) return reply.code(403).send({ ok: false, error: "forbidden" });

    const b: any = (req as any).body || {};
    const data: any = {};

    if (isOwner) {
      if (typeof b.name === "string") data.name = b.name.trim().slice(0, 80) || c.name;
      if (typeof b.className === "string") data.className = b.className.slice(0, 40);
      if (b.level !== undefined) data.level = Math.max(1, Math.min(20, parseInt(b.level) || 1));
      if (typeof b.race === "string") data.race = b.race.slice(0, 40);
      if (typeof b.alignment === "string") data.alignment = b.alignment.slice(0, 40);
      if (b.str !== undefined) data.str = clampScore(b.str);
      if (b.dex !== undefined) data.dex = clampScore(b.dex);
      if (b.con !== undefined) data.con = clampScore(b.con);
      if (b.int !== undefined) data.int = clampScore(b.int);
      if (b.wis !== undefined) data.wis = clampScore(b.wis);
      if (b.cha !== undefined) data.cha = clampScore(b.cha);
      if (b.speed !== undefined) data.speed = clampInt(b.speed, 0, 200, c.speed);
      if (typeof b.hitDice === "string") data.hitDice = b.hitDice.slice(0, 40);
      if (Array.isArray(b.saveProfs)) data.saveProfs = sanitizeSaveProfs(b.saveProfs);
      if (b.skillProfs !== undefined) data.skillProfs = sanitizeSkillProfs(b.skillProfs);
      if (b.spellSlots !== undefined) data.spellSlots = sanitizeSpellSlots(b.spellSlots);
      if (b.spells !== undefined) data.spells = sanitizeSpells(b.spells);
      if (b.inventory !== undefined) data.inventory = sanitizeInventory(b.inventory);
      if (b.cp !== undefined) data.cp = clampInt(b.cp, 0, 1_000_000, c.cp);
      if (b.sp !== undefined) data.sp = clampInt(b.sp, 0, 1_000_000, c.sp);
      if (b.ep !== undefined) data.ep = clampInt(b.ep, 0, 1_000_000, c.ep);
      if (b.gp !== undefined) data.gp = clampInt(b.gp, 0, 1_000_000, c.gp);
      if (b.pp !== undefined) data.pp = clampInt(b.pp, 0, 1_000_000, c.pp);
      if (b.features !== undefined) data.features = sanitizeFeatures(b.features);
      if (b.attacks !== undefined) data.attacks = sanitizeAttacks(b.attacks);
      if (typeof b.notesPlayer === "string") data.notesPlayer = b.notesPlayer.slice(0, 8000);
      if (typeof b.notesParty === "string") data.notesParty = b.notesParty.slice(0, 8000);
      if (b.campaignId !== undefined) data.campaignId = b.campaignId ? String(b.campaignId) : null;
      if (b.roomId !== undefined) data.roomId = b.roomId ? String(b.roomId) : null;
    }

    if (b.hpCurrent !== undefined) data.hpCurrent = clampInt(b.hpCurrent, 0, 999, c.hpCurrent);
    if (b.hpMax !== undefined) data.hpMax = clampInt(b.hpMax, 0, 999, c.hpMax);
    if (b.hpTemp !== undefined) data.hpTemp = clampInt(b.hpTemp, 0, 999, c.hpTemp);
    if (b.ac !== undefined) data.ac = clampInt(b.ac, 0, 50, c.ac);
    if (typeof b.notesDM === "string") data.notesDM = b.notesDM.slice(0, 8000);

    if (Object.keys(data).length === 0) {
      return reply.send({ ok: true, character: withDerived(c) });
    }

    const updated = await prisma.character.update({ where: { id }, data });
    return reply.send({ ok: true, character: withDerived(updated) });
  });

  app.delete("/characters/:id", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const c = await prisma.character.findUnique({ where: { id }, select: { ownerUserId: true } });
    if (!c) return reply.code(404).send({ ok: false, error: "not_found" });
    if (c.ownerUserId !== u.id) return reply.code(403).send({ ok: false, error: "forbidden" });
    await prisma.character.delete({ where: { id } });
    return reply.send({ ok: true });
  });

  app.post("/characters/:id/hp", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const c = await prisma.character.findUnique({ where: { id } });
    if (!c) return reply.code(404).send({ ok: false, error: "not_found" });
    const isOwner = c.ownerUserId === u.id;
    const dm = isOwner ? false : await isDMForCharacter(u.id, c, getGlobalRole, canAccessStaff);
    if (!isOwner && !dm) return reply.code(403).send({ ok: false, error: "forbidden" });

    const b: any = (req as any).body || {};
    const delta = parseInt(b.delta);
    const setTo = b.set !== undefined ? parseInt(b.set) : null;
    let next = c.hpCurrent;
    if (setTo !== null && Number.isFinite(setTo)) next = setTo;
    else if (Number.isFinite(delta)) next = c.hpCurrent + delta;
    next = Math.max(0, Math.min(c.hpMax || 999, next));
    const updated = await prisma.character.update({ where: { id }, data: { hpCurrent: next } });
    return reply.send({ ok: true, character: withDerived(updated) });
  });

  app.post("/characters/:id/spell-slot", async (req, reply) => {
    const u = authFromHeader((req as any).headers?.authorization);
    if (!u) return reply.code(401).send({ ok: false, error: "unauthorized" });
    const id = String((req as any).params?.id || "");
    const c = await prisma.character.findUnique({ where: { id } });
    if (!c) return reply.code(404).send({ ok: false, error: "not_found" });
    if (c.ownerUserId !== u.id) return reply.code(403).send({ ok: false, error: "forbidden" });

    const b: any = (req as any).body || {};
    const lvl = String(b.level || "");
    const op = String(b.op || "toggle");
    const slots: any =
      c.spellSlots && typeof c.spellSlots === "object" ? { ...(c.spellSlots as any) } : {};
    const cur = slots[lvl] && typeof slots[lvl] === "object" ? slots[lvl] : { current: 0, max: 0 };
    let { current, max } = cur as { current: number; max: number };
    current = Math.max(0, Math.floor(Number(current) || 0));
    max = Math.max(0, Math.floor(Number(max) || 0));
    if (op === "use") current = Math.max(0, current - 1);
    else if (op === "restore") current = Math.min(max, current + 1);
    else if (op === "set") {
      if (b.current !== undefined) current = Math.max(0, Math.min(max, parseInt(b.current) || 0));
      if (b.max !== undefined) {
        max = Math.max(0, parseInt(b.max) || 0);
        current = Math.min(current, max);
      }
    } else {
      const idx = parseInt(b.index);
      if (Number.isFinite(idx)) {
        const filled = idx < current;
        current = filled ? idx : Math.max(current, idx + 1);
        current = Math.max(0, Math.min(max, current));
      }
    }
    slots[lvl] = { current, max };
    const updated = await prisma.character.update({ where: { id }, data: { spellSlots: slots } });
    return reply.send({ ok: true, character: withDerived(updated) });
  });
}

function clampInt(v: any, min: number, max: number, fallback: number): number {
  const n = parseInt(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
function clampScore(v: any): number {
  return clampInt(v, 1, 30, 10);
}
function sanitizeSaveProfs(v: any): string[] {
  if (!Array.isArray(v)) return [];
  const allowed = new Set<string>(ABILITY_KEYS as readonly string[]);
  return Array.from(
    new Set(v.map((x: any) => String(x || "").toUpperCase()).filter((x: string) => allowed.has(x))),
  );
}
function sanitizeSkillProfs(v: any): any {
  if (!Array.isArray(v)) return [];
  return v
    .map((row: any) => ({
      skill: String(row?.skill || "").slice(0, 40),
      expertise: !!row?.expertise,
    }))
    .filter((row: any) => row.skill && SKILL_ABILITY[row.skill]);
}
function sanitizeSpellSlots(v: any): any {
  if (!v || typeof v !== "object") return {};
  const out: any = {};
  for (const k of Object.keys(v).slice(0, 9)) {
    const entry: any = v[k] || {};
    const max = clampInt(entry.max, 0, 99, 0);
    const current = Math.min(max, clampInt(entry.current, 0, 99, 0));
    out[String(k)] = { current, max };
  }
  return out;
}
function sanitizeSpells(v: any): any {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 200)
    .map((s: any) => ({
      name: String(s?.name || "").slice(0, 80),
      level: clampInt(s?.level, 0, 9, 0),
    }))
    .filter((s: any) => s.name);
}
function sanitizeInventory(v: any): any {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 200)
    .map((it: any) => ({
      name: String(it?.name || "").slice(0, 80),
      qty: clampInt(it?.qty, 0, 99999, 1),
      equipped: !!it?.equipped,
      attuned: !!it?.attuned,
      notes: String(it?.notes || "").slice(0, 500),
    }))
    .filter((it: any) => it.name);
}
function sanitizeFeatures(v: any): any {
  if (!Array.isArray(v)) return [];
  const allowed = new Set(["race", "class", "feat", "background", "other"]);
  return v
    .slice(0, 100)
    .map((f: any) => ({
      title: String(f?.title || "").slice(0, 80),
      body: String(f?.body || "").slice(0, 4000),
      source: allowed.has(String(f?.source)) ? String(f.source) : "other",
    }))
    .filter((f: any) => f.title);
}
function sanitizeAttacks(v: any): any {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, 50)
    .map((a: any) => ({
      name: String(a?.name || "").slice(0, 60),
      expression: String(a?.expression || "").slice(0, 32),
      damage: String(a?.damage || "").slice(0, 32),
      notes: String(a?.notes || "").slice(0, 200),
    }))
    .filter((a: any) => a.name && a.expression);
}
