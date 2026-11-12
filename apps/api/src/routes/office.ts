// The ECEB office (moved out of routes/auth.ts 2026-11-11, which had grown past
// the 1,500-line limit): office hours and the door, walk-ins, the reception
// desk, and the in-room Fathom plan module. Registered by authRoutes, so every
// path is unchanged.
import type { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { sendPush } from "../lib/notifications";
import { prisma } from "../lib/prisma";
import { sendMail } from "../lib/email";
import {
  addNote,
  readBoard,
  removeNote,
  visibleTo,
  writeBoard,
  type Viewer,
} from "../lib/officeBoard";

type Opts = {
  authFromHeader: (h?: string) => { id: string; name: string } | null;
  // live room presence (roomId -> { users: Map<userId, ...> }).
  rooms: any;
  // GOD-or-allowlist check: lets a normal Weered session act as office host.
  isOfficeStaff: (userId?: string) => Promise<boolean>;
  JWT_SECRET: string;
};

/** The office's address: the one link a client gets. */
export const OFFICE_ORIGIN = "https://office.eastcoastemployeebenefits.com";

export default async function officeRoutes(app: FastifyInstance, opts: Opts) {
  const { authFromHeader, rooms, isOfficeStaff, JWT_SECRET } = opts;

  // Resolve the acting office host: a magic-link token carrying the host claim,
  // OR a logged-in office-staff account (GOD / env allowlist) on a normal Weered
  // session — the same identity that walks into mtg-* rooms without a link.
  const officeHostFromReq = async (
    req: any,
  ): Promise<{ id: string; name: string; office: string } | null> => {
    const u: any = authFromHeader((req.headers as any).authorization);
    if (!u) return null;
    if (u.host)
      return {
        id: String(u.id),
        name: String(u.name || ""),
        office: String(u.scope?.office || ""),
      };
    if (await isOfficeStaff(u.id))
      return { id: String(u.id), name: String(u.name || ""), office: "mtg-eceb" };
    return null;
  };

  // Your way into the office (James 2026-11-11: "Let's combine the two spaces.
  // The client space and this one"): an office host's own session trades for a
  // host pass and lands in the Review Room, the same room the client sits in,
  // as its host. The claims scripts/host-link.sh mints. The pass rides the
  // URL's fragment, which no server and no referrer ever sees; the page moves
  // it to sessionStorage and cleans the address bar.
  app.get("/office/host-pass", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const u = await officeHostFromReq(req);
    if (!u) return reply.redirect(`${OFFICE_ORIGIN}/foyer`);
    const pass = jwt.sign(
      {
        sub: "eceb-host",
        name: "James Stirling",
        host: true,
        scope: { office: "mtg-eceb", foyer: "mtg-eceb-foyer" },
      },
      JWT_SECRET,
      { algorithm: "HS256", expiresIn: "12h" },
    );
    return reply.redirect(`${OFFICE_ORIGIN}/foyer#host=${pass}`);
  });

  // --- OFFICE HOURS (ECEB walk-in office) ---
  // Persistent open/closed flag: the ECEB site shows a live status, and walk-in
  // foyer invites are only mintable while the advisor is holding hours.
  const OFFICE_STATE_FILE = "/opt/weered/office-hours.json";
  const readOfficeState = () => {
    try {
      const st = JSON.parse(readFileSync(OFFICE_STATE_FILE, "utf8"));
      return {
        open: !!st.open,
        schedule: (st.schedule ?? null) as string | null,
        note: (st.note ?? null) as string | null,
        auto: !!st.auto,
      };
    } catch {
      return {
        open: false,
        schedule: null as string | null,
        note: null as string | null,
        auto: false,
      };
    }
  };
  const writeOfficeState = (st: {
    open: boolean;
    schedule: string | null;
    note: string | null;
    auto: boolean;
  }) => {
    writeFileSync(OFFICE_STATE_FILE, JSON.stringify(st));
  };

  // Auto schedule: edge-triggered Mon-Fri 9-17 America/Halifax. Fires only when a
  // boundary is CROSSED, so manual flips between boundaries stick (close early and
  // it stays closed; next morning it opens itself). Opt-in via state.auto.
  const atlNow = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Halifax",
      weekday: "short",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((x) => x.type === t)?.value || "";
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return { day: dayMap[get("weekday").replace(".", "")] ?? 0, hour: Number(get("hour")) % 24 };
  };
  const inOfficeWindow = (d: Date) => {
    const t = atlNow(d);
    return t.day >= 1 && t.day <= 5 && t.hour >= 9 && t.hour < 17;
  };
  let officeAutoLastAt = Date.now();
  setInterval(() => {
    try {
      const st = readOfficeState();
      const prev = inOfficeWindow(new Date(officeAutoLastAt));
      const now = inOfficeWindow(new Date());
      officeAutoLastAt = Date.now();
      if (!st.auto) return;
      if (prev !== now && st.open !== now) writeOfficeState({ ...st, open: now });
    } catch {
      /* best effort */
    }
  }, 60_000);

  // Recent walk-in arrivals (host reception desk). Capped + time-pruned.
  const OFFICE_WAITING_FILE = "/opt/weered/office-waiting.json";
  type Arrival = { name: string; at: number };
  const readWaiting = (): Arrival[] => {
    try {
      const arr = JSON.parse(readFileSync(OFFICE_WAITING_FILE, "utf8"));
      const cutoff = Date.now() - 30 * 60 * 1000;
      return Array.isArray(arr)
        ? arr.filter((a: any) => a && typeof a.at === "number" && a.at > cutoff).slice(-20)
        : [];
    } catch {
      return [];
    }
  };
  const pushWaiting = (name: string) => {
    try {
      const arr = readWaiting();
      arr.push({ name: (name || "Visitor").slice(0, 40), at: Date.now() });
      writeFileSync(OFFICE_WAITING_FILE, JSON.stringify(arr.slice(-20)));
    } catch {
      /* best effort */
    }
  };

  // The advisor is in the office: an office host (a host link, or office staff
  // on their own session) is in its room right now. The door opens itself while
  // they are (James 2026-11-11: "Just send people a quick link and the office is
  // always set up"), so there's no sign to remember to flip.
  const OFFICE_ROOM = "mtg-eceb-office";
  const hostInOffice = async (): Promise<boolean> => {
    const room = rooms?.get?.(OFFICE_ROOM);
    if (!room?.users?.size) return false;
    for (const [key, u] of room.users as Map<string, any>) {
      const id = String(u?.id || key);
      if (id.startsWith("guest_")) continue;
      if (await isOfficeStaff(id)) return true;
    }
    return false;
  };

  // Public: current office status (drives the ECEB-site fixture + the foyer door).
  // The door (the host's Door open / Door closed): open, a visitor walks
  // straight in; closed, they knock. Live when the room is loaded, saved otherwise.
  const doorOpen = async (): Promise<boolean> => {
    const room = rooms?.get?.(OFFICE_ROOM);
    if (room && typeof room.locked === "boolean") return !room.locked;
    const row = await prisma.room
      .findUnique({ where: { id: OFFICE_ROOM }, select: { locked: true } })
      .catch(() => null);
    return row ? !row.locked : false;
  };

  app.get("/office/status", async (_req, reply) => {
    const st = readOfficeState();
    const hostIn = await hostInOffice();
    return reply.send({
      ok: true,
      // The sign (open) is the advisor's hours; receiving is whether the door
      // lets a walk-in knock right now: hours, or the advisor is in.
      receiving: st.open || hostIn,
      hostIn,
      doorOpen: await doorOpen(),
      open: st.open,
      schedule: st.schedule,
      note: st.note,
      auto: st.auto,
    });
  });

  // Host-only: flip the office open/closed (or set the schedule/note).
  app.post("/office/set", async (req, reply) => {
    const u = await officeHostFromReq(req);
    if (!u) return reply.code(403).send({ ok: false, error: "host_only" });
    const body: any = (req as any).body || {};
    const cur = readOfficeState();
    const next = {
      open: typeof body.open === "boolean" ? body.open : cur.open,
      schedule: typeof body.schedule === "string" ? body.schedule.slice(0, 200) : cur.schedule,
      note: typeof body.note === "string" ? body.note.slice(0, 200) : cur.note,
      auto: typeof body.auto === "boolean" ? body.auto : cur.auto,
    };
    writeOfficeState(next);
    return reply.send({ ok: true, ...next });
  });

  // Public walk-in: while open, mint a single-use foyer invite so a visitor can
  // enter with just a name. They still knock; the host still admits.
  app.post(
    "/office/walkin",
    { config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } },
    async (req, reply) => {
      const st = readOfficeState();
      if (!st.open && !(await hostInOffice()))
        return reply.code(403).send({ ok: false, error: "closed", schedule: st.schedule });
      const host = await prisma.user
        .findUnique({ where: { usernameKey: "eceb-host" }, select: { id: true } })
        .catch(() => null);
      const token = `m_${randomBytes(12).toString("hex")}`;
      await prisma.invite.create({
        data: {
          token,
          type: "GUEST",
          targetId: "mtg-eceb",
          createdBy: host?.id ?? "cmmgisqb70000zzfhh3k9e069",
          maxUses: 1,
          uses: 0,
          // Long enough for a whole review (the guest's session follows it).
          expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
        },
      });
      const visitorName =
        typeof (req as any).body?.name === "string" ? (req as any).body.name : "Visitor";
      pushWaiting(visitorName);
      if (host?.id) {
        sendPush(host.id, {
          title: "Someone's at your office door",
          body: `${visitorName} just walked in. Tap to greet them.`,
          url: "/foyer",
          tag: "office-walkin",
        }).catch(() => {});
      }
      return reply.send({ ok: true, url: `/foyer?invite=${token}&title=Office%20Hours` });
    },
  );

  // Host-only: recent walk-in arrivals, for the reception-desk view on the control page.
  app.get("/office/waiting", async (req, reply) => {
    const u = await officeHostFromReq(req);
    if (!u) return reply.code(403).send({ ok: false, error: "host_only" });
    return reply.send({ ok: true, waiting: readWaiting() });
  });

  // --- THE NOTE BOARD (lib/officeBoard.ts) ---
  // James pins notes on the wall for every visitor; a visitor's note is for
  // James alone, and he hears about it by push and email.
  const boardViewer = async (req: any): Promise<Viewer | null> => {
    const host = await officeHostFromReq(req);
    if (host) return { host: true, id: host.id, name: host.name || "James" };
    const u: any = authFromHeader((req.headers as any).authorization);
    if (u?.guest && u.scope?.office === "mtg-eceb")
      return { host: false, id: String(u.id), name: String(u.name || "Visitor") };
    return null;
  };
  const OFFICE_NOTIFY_TO =
    process.env.OFFICE_NOTIFY_TO || process.env.CONTACT_NOTIFY_TO || "james@weered.ca";

  app.get("/office/board", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const v = await boardViewer(req);
    if (!v) return reply.code(401).send({ ok: false, error: "office_only" });
    return reply.send({ ok: true, host: v.host, notes: visibleTo(readBoard(), v) });
  });

  app.post(
    "/office/board",
    { config: { rateLimit: { max: 12, timeWindow: "10 minutes" } } },
    async (req, reply) => {
      const v = await boardViewer(req);
      if (!v) return reply.code(401).send({ ok: false, error: "office_only" });
      const r = addNote(
        readBoard(),
        v,
        (req as any).body?.body,
        Date.now(),
        `n_${randomBytes(6).toString("hex")}`,
      );
      if ("error" in r) return reply.code(400).send({ ok: false, error: r.error });
      writeBoard(r.notes);
      if (r.note.private) {
        const host = await prisma.user
          .findUnique({ where: { usernameKey: "eceb-host" }, select: { id: true } })
          .catch(() => null);
        if (host?.id)
          sendPush(host.id, {
            title: `${r.note.by} left you a note`,
            body: r.note.body.slice(0, 120),
            url: "/foyer",
            tag: "office-note",
          }).catch(() => {});
        const esc = (s: string) =>
          s.replace(
            /[&<>"]/g,
            (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
          );
        sendMail({
          to: OFFICE_NOTIFY_TO,
          subject: `[office] ${r.note.by} left you a note`,
          html: `<p>${esc(r.note.by)} left a note on the office board:</p><blockquote>${esc(r.note.body).replace(/\n/g, "<br>")}</blockquote><p>${OFFICE_ORIGIN}</p>`,
          text: `${r.note.by} left a note on the office board:\n\n${r.note.body}\n\n${OFFICE_ORIGIN}`,
        }).catch(() => {});
      }
      return reply.send({ ok: true, note: r.note });
    },
  );

  app.delete("/office/board/:id", async (req, reply) => {
    const v = await boardViewer(req);
    if (!v) return reply.code(401).send({ ok: false, error: "office_only" });
    const r = removeNote(readBoard(), String((req.params as any).id || ""), v);
    if (!r.removed) return reply.code(404).send({ ok: false, error: "not_found" });
    writeBoard(r.notes);
    return reply.send({ ok: true });
  });

  // --- IN-ROOM FATHOM PLAN MODULE (read proxy) ---
  // The office (client browser) never holds the engine token: it calls these
  // host-gated routes same-origin, and the API mints a short-lived office:read
  // token (shared OFFICE_TOKEN_SECRET) to fetch the tenant-scoped plan from the
  // Fathom engine server-side.
  const ENGINE_BASE =
    process.env.FATHOM_ENGINE_URL || "https://agent.eastcoastemployeebenefits.com";
  // A "book" selects which tenant the office reads: the real ECEB book (default)
  // or the Scotia demo book. Constrained to these two — never an arbitrary tenant.
  const bookConfig = (book: string) =>
    book === "demo"
      ? { tenantId: process.env.DEMO_TENANT_ID, brokerId: process.env.DEMO_BROKER_ID }
      : { tenantId: process.env.ECEB_TENANT_ID, brokerId: process.env.ECEB_BROKER_ID };
  const mintOfficeToken = (scope: string[], book: string) => {
    const { tenantId, brokerId } = bookConfig(book);
    return jwt.sign(
      { typ: "office", tenantId, brokerId, meetingId: null, scope },
      process.env.OFFICE_TOKEN_SECRET as string,
      { algorithm: "HS256", issuer: "abb-office", audience: "engine-api", expiresIn: 600 },
    );
  };
  const engineGet = async (path: string, book: string) => {
    const res = await fetch(`${ENGINE_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${mintOfficeToken(["office:read"], book)}`,
        Origin: "https://office.eastcoastemployeebenefits.com",
      },
    });
    return { status: res.status, text: await res.text() };
  };
  const engineSend = async (method: string, path: string, body: any, book: string) => {
    const res = await fetch(`${ENGINE_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${mintOfficeToken(["office:read", "office:write"], book)}`,
        "Content-Type": "application/json",
        Origin: "https://office.eastcoastemployeebenefits.com",
      },
      body: JSON.stringify(body ?? {}),
    });
    return { status: res.status, text: await res.text() };
  };
  const planGate = async (req: any, reply: any): Promise<boolean> => {
    const u = await officeHostFromReq(req);
    if (!u) {
      reply.code(403).send({ ok: false, error: "host_only" });
      return false;
    }
    const book = String((req.query as any)?.book ?? "eceb");
    if (book !== "eceb" && book !== "demo") {
      reply.code(400).send({ ok: false, error: "unknown_book" });
      return false;
    }
    // Gate on the tenant for the ACTUALLY-selected book, so a missing DEMO_* env
    // can never mint an office token with an undefined tenant claim.
    const { tenantId, brokerId } = bookConfig(book);
    if (!process.env.OFFICE_TOKEN_SECRET || !tenantId || !brokerId) {
      reply.code(503).send({ ok: false, error: "engine_not_configured" });
      return false;
    }
    return true;
  };

  // Host-only: client picker (proxied to the engine, tenant-scoped there).
  app.get("/office/plan/employers", async (req, reply) => {
    if (!(await planGate(req, reply))) return;
    const book = String((req.query as any)?.book ?? "eceb");
    const q = encodeURIComponent(String((req.query as any)?.q ?? "").slice(0, 80));
    const r = await engineGet(`/api/office/employers?q=${q}`, book);
    return reply.code(r.status).header("content-type", "application/json").send(r.text);
  });

  // Host-only: the engine's rendered client deck for this employer — the SAME
  // document the emailable /p link serves, so the room presents one artifact
  // instead of a hand-drawn twin that drifts. Returned as {html} for the host
  // to include in the presented snapshot (guests render it in a sandboxed
  // iframe via /office/plan/presented).
  app.get("/office/plan/deck/:employerId", async (req, reply) => {
    if (!(await planGate(req, reply))) return;
    const book = String((req.query as any)?.book ?? "eceb");
    const id = encodeURIComponent(String((req.params as any).employerId));
    const r = await engineGet(`/api/office/employers/${id}/deck`, book);
    if (r.status !== 200)
      return reply.code(r.status).send({ ok: false, error: "deck_unavailable" });
    return reply.send({ ok: true, html: r.text });
  });

  // Host-only: full client detail + current plan of record.
  app.get("/office/plan/employer/:id", async (req, reply) => {
    if (!(await planGate(req, reply))) return;
    const book = String((req.query as any)?.book ?? "eceb");
    const id = encodeURIComponent(String((req.params as any).id));
    const r = await engineGet(`/api/office/employers/${id}`, book);
    return reply.code(r.status).header("content-type", "application/json").send(r.text);
  });

  // Host-only: apply a change-set to the plan of record (creates a new version).
  app.patch(
    "/office/plan/employer/:id",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (!(await planGate(req, reply))) return;
      const book = String((req.query as any)?.book ?? "eceb");
      const id = String((req.params as any).id);
      const r = await engineSend(
        "PATCH",
        `/api/employers/${encodeURIComponent(id)}/plan`,
        (req as any).body,
        book,
      );
      return reply.code(r.status).header("content-type", "application/json").send(r.text);
    },
  );

  // Host-only: send a plan amendment notice to the carrier (Resend, engine-side).
  app.post(
    "/office/plan/amend",
    { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (!(await planGate(req, reply))) return;
      const book = String((req.query as any)?.book ?? "eceb");
      const body: any = (req as any).body || {};
      const email = String(body.carrierEmail ?? "").trim();
      // Linear, length-capped email shape check. The old regex
      // (/^[^\s@]+@[^\s@]+\.[^\s@]+$/) backtracks polynomially on a long
      // no-@ string, and the length cap ran only after the regex. indexOf-based
      // structural checks are O(n) and can't be forced to backtrack.
      const emailOk = (() => {
        if (email.length === 0 || email.length > 200) return false;
        if (/\s/.test(email)) return false; // single char class → linear
        const at = email.indexOf("@");
        if (at <= 0 || at !== email.lastIndexOf("@")) return false; // exactly one @, not leading
        const dot = email.lastIndexOf(".");
        return dot > at + 1 && dot < email.length - 1; // dot inside the domain, not at an edge
      })();
      if (
        !body.employerId ||
        !body.planId ||
        !body.version ||
        !Array.isArray(body.changes) ||
        body.changes.length === 0 ||
        !body.effectiveDate ||
        !emailOk
      ) {
        return reply.code(400).send({ ok: false, error: "invalid_amendment" });
      }
      const r = await engineSend("POST", `/api/plan-amendments/send`, body, book);
      return reply.code(r.status).header("content-type", "application/json").send(r.text);
    },
  );

  // --- RENEWAL RATE CARD (present-side) ---
  // A pure re-rate travels carrier -> broker: the carrier set the rates, so nothing
  // is ever sent back. This card is what the broker SHOWS the room. Persisted
  // droplet-side (keyed per book+employer) so keyed-in rates survive a refresh;
  // the engine grows a versioned RateCard later and this becomes its display leg.
  // Row shape deliberately mirrors the engine renewal parser's RateRow (benefit /
  // tier-or-unit / current / renewal / % change) so doc-drop fill is a straight map.
  const RATECARD_FILE = "/opt/weered/office-ratecards.json";
  const rcKey = (book: string, id: string) => `${book}:${id}`;
  const loadRateCards = (): Record<string, any> => {
    try {
      return JSON.parse(readFileSync(RATECARD_FILE, "utf8"));
    } catch {
      return {};
    }
  };
  const rcNum = (v: any): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && Math.abs(n) < 1e9 ? Math.round(n * 10000) / 10000 : null;
  };
  const rcStr = (v: any, max: number): string => String(v ?? "").slice(0, max);
  // Whitelist projection: also reused when presenting, so a guest snapshot can only
  // ever carry these fields. pctChange is stored in PERCENT units (8.2 = +8.2%).
  const sanitizeRateCard = (raw: any): any | null => {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.rows)) return null;
    const rows = raw.rows
      .slice(0, 40)
      .map((r: any) => ({
        benefit: rcStr(r?.benefit, 60).trim(),
        tier: rcStr(r?.tier, 40).trim(),
        volumeOrLives: rcNum(r?.volumeOrLives),
        currentRate: rcNum(r?.currentRate),
        currentPremium: rcNum(r?.currentPremium),
        renewalRate: rcNum(r?.renewalRate),
        renewalPremium: rcNum(r?.renewalPremium),
        pctChange: rcNum(r?.pctChange),
      }))
      .filter((r: any) => r.benefit !== "");
    if (!rows.length) return null;
    return {
      rows,
      effectiveDate: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.effectiveDate ?? ""))
        ? String(raw.effectiveDate)
        : null,
      rateGuaranteeMonths: rcNum(raw.rateGuaranteeMonths),
      note: rcStr(raw.note, 300).trim() || null,
    };
  };

  app.get("/office/plan/ratecard/:id", async (req, reply) => {
    if (!(await planGate(req, reply))) return;
    const book = String((req.query as any)?.book ?? "eceb");
    const id = String((req.params as any).id).slice(0, 60);
    const cards = loadRateCards();
    return reply.send({ ok: true, card: cards[rcKey(book, id)] ?? null });
  });

  app.put(
    "/office/plan/ratecard/:id",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (!(await planGate(req, reply))) return;
      const book = String((req.query as any)?.book ?? "eceb");
      const id = String((req.params as any).id).slice(0, 60);
      const body: any = (req as any).body || {};
      const cards = loadRateCards();
      if (body.card === null) {
        delete cards[rcKey(book, id)];
        writeFileSync(RATECARD_FILE, JSON.stringify(cards));
        return reply.send({ ok: true, card: null });
      }
      const card = sanitizeRateCard(body.card);
      if (!card) return reply.code(400).send({ ok: false, error: "invalid_ratecard" });
      card.updatedAt = Date.now();
      cards[rcKey(book, id)] = card;
      writeFileSync(RATECARD_FILE, JSON.stringify(cards));
      return reply.send({ ok: true, card });
    },
  );

  // --- IN-ROOM RENEWAL PROJECTION (engine computes; stateless, no writes) ---
  // Proxies the engine's credibility-weighted projection: three paths (status
  // quo / capped / with levers) + the lever catalog priced for THIS group. The
  // room renders levers from the response, never a hardcoded list. Engine
  // rate-limits 300/10min; we gate tighter per host.
  app.post(
    "/office/plan/projection/:id",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (!(await planGate(req, reply))) return;
      const book = String((req.query as any)?.book ?? "eceb");
      const id = String((req.params as any).id).slice(0, 60);
      const r = await engineSend(
        "POST",
        `/api/office/employers/${encodeURIComponent(id)}/projection`,
        (req as any).body ?? {},
        book,
      );
      return reply.code(r.status).header("content-type", "application/json").send(r.text);
    },
  );

  // --- IN-ROOM RENEWAL REVIEW + PROPOSAL (engine content; the three-tab consult) ---
  // REVIEW: the full renewal audit for presentation. PROPOSAL: the sign-off
  // side-by-side (current / renewal / appeal target / with changes) + forecasts.
  // Both proxied like the projection; 404 passes through as "none on file yet".
  app.get(
    "/office/plan/review/:id",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (!(await planGate(req, reply))) return;
      const book = String((req.query as any)?.book ?? "eceb");
      const id = String((req.params as any).id).slice(0, 60);
      const r = await engineGet(`/api/office/employers/${encodeURIComponent(id)}/review`, book);
      return reply.code(r.status).header("content-type", "application/json").send(r.text);
    },
  );

  app.post(
    "/office/plan/proposal/:id",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (req, reply) => {
      if (!(await planGate(req, reply))) return;
      const book = String((req.query as any)?.book ?? "eceb");
      const id = String((req.params as any).id).slice(0, 60);
      const r = await engineSend(
        "POST",
        `/api/office/employers/${encodeURIComponent(id)}/proposal`,
        (req as any).body ?? {},
        book,
      );
      return reply.code(r.status).header("content-type", "application/json").send(r.text);
    },
  );

  // Display-only whitelist for a PRESENTED projection: paths, per-lever savings,
  // intensity, loss ratio. Never the catalog, assumptions, or benefit internals —
  // the client screen shows outcomes, not the model's dials.
  const sanitizeProjection = (raw: any): any | null => {
    if (!raw || typeof raw !== "object" || !raw.paths || typeof raw.paths !== "object") return null;
    const p: any = raw.paths;
    const path2 = (x: any) =>
      x && typeof x === "object"
        ? { annual: rcNum(x.annual), changePct: rcNum(x.changePct) }
        : null;
    const statusQuo = path2(p.statusQuo);
    const capped = path2(p.capped);
    const withLevers = path2(p.withLevers);
    const currentAnnual = rcNum(p.currentAnnual);
    if (currentAnnual == null || !statusQuo || statusQuo.annual == null) return null;
    return {
      paths: {
        currentAnnual,
        statusQuo,
        capped: capped ? { ...capped, capped: !!p.capped?.capped } : null,
        withLevers: withLevers
          ? { ...withLevers, totalClaimsSaved: rcNum(p.withLevers?.totalClaimsSaved) }
          : null,
      },
      perLever: Array.isArray(raw.perLever)
        ? raw.perLever
            .slice(0, 20)
            .map((l: any) => ({
              name: rcStr(l?.name, 80).trim(),
              claimsSaved: rcNum(l?.claimsSaved),
              memberImpact: rcStr(l?.memberImpact, 10),
            }))
            .filter((l: any) => l.name !== "")
        : [],
      intensity: rcStr(raw.intensity, 14),
      overallLossRatio: rcNum(raw.overallLossRatio),
      // Optional loss-ratio trio (percent units) for the presentation gauge; when
      // the engine emits it the client doc upgrades to the exact loss-ratio story.
      lossRatio:
        raw.lossRatio && typeof raw.lossRatio === "object"
          ? {
              current: rcNum(raw.lossRatio.current),
              withLevers: rcNum(raw.lossRatio.withLevers),
              target: rcNum(raw.lossRatio.target),
            }
          : null,
    };
  };

  // Whitelists for the PRESENTED review + proposal (the three-tab consult).
  // Shape-tolerant to the pinned engine contract; anything not listed is
  // dropped, every string capped, every number normalized. A guest can only
  // ever receive these fields.
  const rcStrN = (v: any, max: number): string | null => {
    const s = rcStr(v, max).trim();
    return s === "" ? null : s;
  };
  // appeal targets may be a number or a {low, high} range
  const rcNumOrRange = (v: any): any => {
    if (v && typeof v === "object") return { low: rcNum(v.low), high: rcNum(v.high) };
    return rcNum(v);
  };
  // "Deployable" figures behind a plain statement (paediatrician disclosure):
  // a short table of { label, value } strings the client can reveal on click.
  const rcFigures = (v: any): { label: string; value: string }[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    const out = v
      .slice(0, 8)
      .map((f: any) => ({ label: rcStr(f?.label, 80), value: rcStr(f?.value, 80) }))
      .filter((f) => f.label !== "" || f.value !== "");
    return out.length ? out : undefined;
  };
  // A plain statement line that may deploy to its figure: a bare string stays a
  // string; { plain, detail?, figures? } is whitelisted to exactly those fields.
  const rcDeployable = (v: any, max: number): any => {
    if (v && typeof v === "object") {
      const figures = rcFigures(v.figures);
      const detail = rcStrN(v.detail, 600);
      const plain = rcStr(v.plain, max);
      if (!detail && !figures) return plain; // no payload behind it → collapse to text
      const o: any = { plain };
      if (detail) o.detail = detail;
      if (figures) o.figures = figures;
      return o;
    }
    return rcStr(v, max);
  };
  const sanitizeReview = (raw: any): any | null => {
    if (!raw || typeof raw !== "object" || !raw.headline) return null;
    const h: any = raw.headline;
    const recon: any = raw.reconciliation;
    return {
      builtAt: rcStrN(raw.builtAt, 40),
      disclaimers: Array.isArray(raw.disclaimers)
        ? raw.disclaimers.slice(0, 6).map((s: any) => rcStr(s, 500))
        : [],
      // The engine's reconciliation (ask / supported / gap) — numbers only.
      // The presentation prefers this over deriving its own supported figure.
      reconciliation:
        recon && typeof recon === "object"
          ? {
              askAnnual: rcNum(recon.askAnnual),
              askMonthly: rcNum(recon.askMonthly),
              askPct: rcNum(recon.askPct),
              supportedAnnual: rcNum(recon.supportedAnnual),
              supportedPct: rcNum(recon.supportedPct),
              gapAnnual: rcNum(recon.gapAnnual),
              gapPctOfAsk: rcNum(recon.gapPctOfAsk),
              fair: recon.fair === true,
            }
          : null,
      headline: {
        carrier: rcStrN(h.carrier, 60),
        policy: rcStrN(h.policy, 40),
        pct: rcNum(h.pct),
        monthlyFrom: rcNum(h.monthlyFrom),
        monthlyTo: rcNum(h.monthlyTo),
        annualDelta: rcNum(h.annualDelta),
        effective: rcStrN(h.effective, 40),
        experienceWindow: rcStrN(h.experienceWindow, 80),
        lives: rcNum(h.lives),
        avgAgeFrom: rcNum(h.avgAgeFrom),
        avgAgeTo: rcNum(h.avgAgeTo),
      },
      lossRatios: Array.isArray(raw.lossRatios)
        ? raw.lossRatios.slice(0, 20).map((r: any) => ({
            benefit: rcStr(r?.benefit, 60),
            lossRatio: rcNum(r?.lossRatio),
            credibility: rcNum(r?.credibility),
            rateChangePct: rcNum(r?.rateChangePct),
            target: rcNum(r?.target),
          }))
        : [],
      drivers: Array.isArray(raw.drivers)
        ? raw.drivers.slice(0, 20).map((d: any) => ({
            kind: ["warn", "info", "lever"].includes(d?.kind) ? d.kind : "info",
            title: rcStr(d?.title, 140),
            body: rcStr(d?.body, 800),
            detail: rcStrN(d?.detail, 600),
            figures: rcFigures(d?.figures),
          }))
        : [],
      roadmap: raw.roadmap
        ? {
            renewsAt: rcStrN(raw.roadmap.renewsAt, 40),
            windowClosesAt: rcStrN(raw.roadmap.windowClosesAt, 40),
            pctElapsed: rcNum(raw.roadmap.pctElapsed),
            items: Array.isArray(raw.roadmap.items)
              ? raw.roadmap.items.slice(0, 12).map((i: any) => ({
                  title: rcStr(i?.title, 140),
                  body: rcStr(i?.body, 800),
                  due: rcStrN(i?.due, 60),
                  badge: rcStrN(i?.badge, 90),
                  memberFacing: Boolean(i?.memberFacing),
                }))
              : [],
          }
        : null,
      diagnosis: Array.isArray(raw.diagnosis)
        ? raw.diagnosis.slice(0, 20).map((s: any) => rcDeployable(s, 400))
        : [],
      scenarios: Array.isArray(raw.scenarios)
        ? raw.scenarios.slice(0, 6).map((s: any) => ({
            title: rcStr(s?.title, 140),
            body: rcStr(s?.body, 800),
          }))
        : [],
      levers: Array.isArray(raw.levers)
        ? raw.levers.slice(0, 12).map((l: any) => ({
            title: rcStr(l?.title, 140),
            body: rcStr(l?.body, 800),
            saveLow: rcNum(l?.saveLow),
            saveHigh: rcNum(l?.saveHigh),
            badge: rcStrN(l?.badge, 90),
            catalogId: rcStrN(l?.catalogId, 60),
            detail: rcStrN(l?.detail, 600),
            figures: rcFigures(l?.figures),
          }))
        : [],
      demographics: raw.demographics
        ? {
            lives: rcNum(raw.demographics.lives),
            avgAge: rcNum(raw.demographics.avgAge),
            dobOnFile: rcStrN(raw.demographics.dobOnFile, 20),
            ageBands: Array.isArray(raw.demographics.ageBands)
              ? raw.demographics.ageBands.slice(0, 8).map((b: any) => ({
                  band: rcStr(b?.band, 20),
                  count: rcNum(b?.count),
                }))
              : [],
            coverageMix: Array.isArray(raw.demographics.coverageMix)
              ? raw.demographics.coverageMix.slice(0, 8).map((c: any) => ({
                  label: rcStr(c?.label, 30),
                  count: rcNum(c?.count),
                }))
              : [],
          }
        : null,
      benchmark: raw.benchmark
        ? {
            verdict: rcStrN(raw.benchmark.verdict, 40),
            scope: rcStrN(raw.benchmark.scope, 80),
            note: rcStrN(raw.benchmark.note, 400),
          }
        : null,
    };
  };
  const sanitizeProposal = (raw: any): any | null => {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.lines)) return null;
    const lines = raw.lines.slice(0, 30).map((l: any) => ({
      benefit: rcStr(l?.benefit, 60),
      tier: rcStr(l?.tier, 40),
      current: rcNum(l?.current),
      renewal: rcNum(l?.renewal),
      appealTarget: rcNumOrRange(l?.appealTarget),
      withChanges: rcNum(l?.withChanges),
    }));
    if (!lines.length) return null;
    const t: any = raw.totals || {};
    return {
      lines,
      totals: {
        current: rcNum(t.current),
        renewal: rcNum(t.renewal),
        appealTarget: rcNumOrRange(t.appealTarget),
        withChanges: rcNum(t.withChanges),
        renewalPct: rcNum(t.renewalPct),
        appealPct: rcNum(t.appealPct),
        withChangesPct: rcNum(t.withChangesPct),
      },
      appealBasis: Array.isArray(raw.appealBasis)
        ? raw.appealBasis.slice(0, 12).map((s: any) => rcDeployable(s, 500))
        : [],
      benchmark: raw.benchmark
        ? {
            verdict: rcStrN(raw.benchmark.verdict, 40),
            scope: rcStrN(raw.benchmark.scope, 80),
            note: rcStrN(raw.benchmark.note, 400),
          }
        : null,
      forecasts: Array.isArray(raw.forecasts)
        ? raw.forecasts.slice(0, 6).map((f: any) => ({
            scenario: rcStr(f?.scenario, 40),
            label: rcStr(f?.label, 140),
            nextRenewalAnnual: rcNum(f?.nextRenewalAnnual),
            changePct: rcNum(f?.changePct),
            notes: rcStrN(f?.notes, 400),
          }))
        : [],
      disclaimers: Array.isArray(raw.disclaimers)
        ? raw.disclaimers.slice(0, 6).map((s: any) => rcStr(s, 500))
        : [],
    };
  };

  // --- LIVE PLAN PRESENTATION ---
  // The host "presents" a plan snapshot to the room; admitted guests poll it
  // read-only. Guests only ever see exactly what the host chose to present.
  // In-memory by design: ephemeral meeting state (host re-presents after a restart).
  const presentedPlans = new Map<string, { data: any; seq: number; at: number }>();
  let presentedSeq = 0;

  app.post("/office/plan/present", async (req, reply) => {
    const u = await officeHostFromReq(req);
    if (!u) return reply.code(403).send({ ok: false, error: "host_only" });
    const office = u.office;
    if (!office) return reply.code(400).send({ ok: false, error: "no_office_scope" });
    const raw = (req as any).body?.data ?? null;
    // Project to a display-only whitelist: the guest snapshot can never carry ids
    // or engine internals the read-only viewer doesn't render.
    const data = raw
      ? {
          employer: {
            name: raw.employer?.name ?? null,
            carrier: raw.employer?.carrier ?? null,
            carrierPolicy: raw.employer?.carrierPolicy ?? null,
            renewalMonth: raw.employer?.renewalMonth ?? null,
            lives: raw.employer?.lives ?? null,
            premium: raw.employer?.premium ?? null,
          },
          plan: raw.plan
            ? { benefitDesign: raw.plan.benefitDesign ?? {}, version: raw.plan.version ?? null }
            : null,
          fields: raw.fields ?? {},
          // same projection as storage: a guest can only ever see whitelisted fields
          rateCard: sanitizeRateCard(raw.rateCard),
          projection: sanitizeProjection(raw.projection),
          review: sanitizeReview(raw.review),
          proposal: sanitizeProposal(raw.proposal),
          // The engine's rendered client deck — the SAME document the emailable
          // /p link serves, produced entirely by the Fathom engine (which owns
          // the client-privacy scrub). Carried as display-only HTML the viewer
          // renders in a sandboxed iframe; size-capped below with the rest.
          deckHtml:
            typeof raw.deckHtml === "string" && raw.deckHtml.length <= 150_000
              ? raw.deckHtml
              : null,
        }
      : null;
    if (data) {
      // 400k, up from 200k: the snapshot may now carry the engine's rendered
      // deck (~50-80k of HTML) alongside the JSON sections.
      if (JSON.stringify(data).length > 400_000)
        return reply.code(400).send({ ok: false, error: "too_large" });
      presentedPlans.set(office, { data, seq: ++presentedSeq, at: Date.now() });
    } else {
      presentedPlans.delete(office);
    }
    return reply.send({ ok: true, presenting: presentedPlans.has(office) });
  });

  app.get("/office/plan/presented", async (req, reply) => {
    const u = authFromHeader((req.headers as any).authorization);
    const uu = u as any;
    if (!u) return reply.code(403).send({ ok: false, error: "auth_required" });
    let office = String(uu.scope?.office || "");
    // office-staff sessions (GOD/allowlist, no host claim) may read too — same
    // acceptance as every other host gate
    if (!uu.host && !uu.guest) {
      const h = await officeHostFromReq(req);
      if (!h) return reply.code(403).send({ ok: false, error: "auth_required" });
      office = h.office;
    }
    // ISOLATION: a guest reads the presented plan ONLY while LIVE in the consult
    // room. A waiting-room guest (in the -foyer room) or a stale/ex token is not
    // in the -office room's presence, so it sees nothing. The shared office scope
    // is NOT the boundary; live admission is.
    if (uu.guest) {
      const gid = String(uu.id || "");
      const room = rooms?.get(`${office}-office`);
      if (!room || !room.users || !room.users.has(gid)) {
        return reply.send({ ok: true, seq: 0, data: null });
      }
    }
    const p = office ? presentedPlans.get(office) : undefined;
    if (p && Date.now() - p.at > 4 * 60 * 60 * 1000) {
      presentedPlans.delete(office);
      return reply.send({ ok: true, seq: 0, data: null });
    }
    return reply.send({ ok: true, seq: p?.seq ?? 0, data: p?.data ?? null });
  });

  // Bookmarkable host control page, served same-origin so the toggle needs no CORS.
  app.get("/office/control", async (_req, reply) => {
    reply.header("Content-Type", "text/html; charset=utf-8");
    reply.header("Cache-Control", "no-store");
    try {
      return reply.send(readFileSync("/opt/weered/office-control.html", "utf8"));
    } catch {
      return reply.code(404).send("control not found");
    }
  });
}
