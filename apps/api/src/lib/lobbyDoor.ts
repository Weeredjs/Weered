// A lobby's front door (James 2026-10-30): the welcome, rules, questions and
// gates a visitor gets through before joining. Owners set it in Admin → Front
// door; it lives in Lobby.layout.door (the full shape is in
// apps/web/lib/lobbyLayout.ts, which also draws the door). The overlay only
// asks: joining is checked here, on the server.

export type DoorQuestion = {
  id: string;
  q: string;
  kind: "text" | "choice";
  options: string[];
  required: boolean;
};

export type Door = {
  rules: string[];
  questions: DoorQuestion[];
  age18: boolean;
  minAccountDays: number;
};

/** Kept with the membership (LobbyMember.door) or the join request
 *  (LobbyJoinRequest.answers). Each answer carries its question as it was
 *  asked, so a later edit to the questions can't change what was answered. */
export type DoorEntry = {
  at: string;
  rulesAccepted?: true;
  age18?: true;
  answers: { q: string; a: string }[];
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const CONTROL = /[\u0000-\u001f\u007f]/g;

/** The door's requirements, or null when the lobby has no door switched on. */
export function readDoor(layout: unknown): Door | null {
  const d = layout && typeof layout === "object" ? (layout as any).door : null;
  if (!d || typeof d !== "object" || d.on !== true) return null;
  const rules = (Array.isArray(d.rules) ? d.rules : [])
    .map((r: unknown) => str(r, 200))
    .filter(Boolean)
    .slice(0, 12);
  const questions: DoorQuestion[] = (Array.isArray(d.questions) ? d.questions : [])
    .slice(0, 5)
    .map((q: any) => ({
      id: str(q?.id, 40),
      q: str(q?.q, 140),
      kind: q?.kind === "choice" ? ("choice" as const) : ("text" as const),
      options: (Array.isArray(q?.options) ? q.options : [])
        .map((o: unknown) => str(o, 40))
        .filter(Boolean)
        .slice(0, 8),
      required: q?.required === true,
    }))
    .filter((q: DoorQuestion) => q.id && q.q && (q.kind === "text" || q.options.length >= 2));
  const days = Math.floor(Number(d.minAccountDays));
  return {
    rules,
    questions,
    age18: d.age18 === true,
    minAccountDays: Number.isFinite(days) ? Math.max(0, Math.min(365, days)) : 0,
  };
}

/** Checks a join against the door: the entry to keep, or why not. */
export function passDoor(
  door: Door,
  body: any,
  accountCreatedAt: Date | null,
  now = new Date(),
): { ok: true; entry: DoorEntry } | { ok: false; error: string; message: string } {
  if (door.minAccountDays > 0) {
    const days = accountCreatedAt ? (now.getTime() - accountCreatedAt.getTime()) / 86_400_000 : 0;
    if (days < door.minAccountDays)
      return {
        ok: false,
        error: "account_too_new",
        message: `This lobby takes accounts older than ${door.minAccountDays} day${
          door.minAccountDays === 1 ? "" : "s"
        }.`,
      };
  }
  if (door.age18 && body?.age18 !== true)
    return { ok: false, error: "age_required", message: "This lobby is for people 18 or older." };
  if (door.rules.length && body?.acceptRules !== true)
    return { ok: false, error: "rules_required", message: "Accept the lobby's rules to join." };
  const given = body?.answers && typeof body.answers === "object" ? body.answers : {};
  const answers: DoorEntry["answers"] = [];
  for (const q of door.questions) {
    const raw = Object.prototype.hasOwnProperty.call(given, q.id) ? given[q.id] : "";
    let a = typeof raw === "string" ? raw.replace(CONTROL, " ").trim().slice(0, 500) : "";
    if (q.kind === "choice" && a && !q.options.includes(a)) a = "";
    if (!a && q.required)
      return { ok: false, error: "answers_required", message: `Please answer: ${q.q}` };
    if (a) answers.push({ q: q.q, a });
  }
  return {
    ok: true,
    entry: {
      at: now.toISOString(),
      ...(door.rules.length ? { rulesAccepted: true as const } : {}),
      ...(door.age18 ? { age18: true as const } : {}),
      answers,
    },
  };
}
