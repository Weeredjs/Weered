"use client";
// Follow-up bookings in the office (api routes/officeBooking.ts). James
// 2026-11-16: "a booking calendar that syncs with outlook and can be included
// in the office to book followups." A visitor books a time; James books one
// for a visitor from the participants list, and keeps his hours, his time
// away and the calendar feed Outlook subscribes to under Bookings.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

const API = "/api";
const TZ = "America/Halifax";
const GOLD = "#C6A15B";
const INK = "rgba(236,242,250,.95)";
const MUTED = "rgba(163,180,202,.72)";
const LINE = "#1E3A5F";
const UIFONT = "'Segoe UI', Inter, system-ui, -apple-system, sans-serif";
const SERIF = "Georgia, 'Iowan Old Style', Cambria, 'Times New Roman', serif";

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, ...o }).format(new Date(iso));
const dayKey = (iso: string) => fmt(iso, { year: "numeric", month: "2-digit", day: "2-digit" });
const timeOf = (iso: string) => fmt(iso, { hour: "numeric", minute: "2-digit" });
const longWhen = (iso: string) =>
  `${fmt(iso, { weekday: "long", month: "long", day: "numeric" })} at ${timeOf(iso)}`;

/** A Halifax wall-clock time → ISO (the same rule as api lib/officeBooking.ts). */
function halifaxIso(date: string, hhmm: string): string {
  const off = (at: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: TZ,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
        .formatToParts(new Date(at))
        .map((x) => [x.type, x.value]),
    );
    return (
      (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) -
        Math.floor(at / 60000) * 60000) /
      60000
    );
  };
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - off(guess) * 60000;
  t = guess - off(t) * 60000;
  return new Date(t).toISOString();
}

const ERRORS: Record<string, string> = {
  slot_taken: "That time was just taken. Pick another.",
  already_booked:
    "You already have two follow-ups booked. Reply to your confirmation email to change one.",
  email_invalid: "That email address doesn't look right.",
  name_required: "Add a name.",
  calendar_full: "The calendar is full just now. Please message James.",
  office_only: "Your visit has ended. Open the office link again to book.",
};

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div style={B.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ ...B.card, maxWidth: wide ? 760 : 560 }}
      >
        <div style={B.head}>
          <span style={B.title}>{title}</span>
          <button style={B.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div style={B.body}>{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Book a follow-up (a visitor, or James for a visitor)
// ---------------------------------------------------------------------------
export function BookFollowUp({
  host,
  getToken,
  defaultName = "",
  onClose,
}: {
  host: boolean;
  getToken: () => string | null;
  defaultName?: string;
  onClose: () => void;
}) {
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slotMin, setSlotMin] = useState(30);
  const [day, setDay] = useState("");
  const [pick, setPick] = useState("");
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string>("");

  const load = useCallback(() => {
    fetch(`${API}/office/booking/slots`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const s: string[] = Array.isArray(j?.slots) ? j.slots : [];
        setSlots(s);
        if (j?.slotMin) setSlotMin(j.slotMin);
        setDay((d) => (d && s.some((x) => dayKey(x) === d) ? d : s[0] ? dayKey(s[0]) : ""));
      })
      .catch(() => setSlots([]));
  }, []);
  useEffect(load, [load]);

  const days = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of slots || []) if (!m.has(dayKey(s))) m.set(dayKey(s), s);
    return [...m.entries()].slice(0, 21);
  }, [slots]);
  const times = (slots || []).filter((s) => dayKey(s) === day);

  const submit = async () => {
    if (!pick) return setErr("Pick a time.");
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`${API}/office/booking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken() || ""}`,
        },
        body: JSON.stringify({ start: pick, name, email, note }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) setErr("Too many tries. Try again in a little while.");
      else if (!r.ok || !j?.ok) {
        setErr(ERRORS[j?.error] || "Couldn't book that. Try again.");
        if (j?.error === "slot_taken") {
          setPick("");
          load();
        }
      } else setDone(pick);
    } catch {
      setErr("Couldn't reach the office. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <Modal title="Booked" onClose={onClose}>
        <p style={B.lead}>
          {host ? `${name}'s follow-up` : "Your follow-up"} is on <b>{longWhen(done)}</b>{" "}
          <span style={{ color: MUTED }}>(Atlantic time)</span>.
        </p>
        <p style={B.p}>
          An invite with the office link is on its way to <b>{email}</b>.
          {host
            ? " It's on your office calendar too."
            : " At that time, open the same office link."}
        </p>
        <button style={B.primary} onClick={onClose}>
          Done
        </button>
      </Modal>
    );

  return (
    <Modal title={host ? "Book a follow-up" : "Book a follow-up with James"} onClose={onClose}>
      {slots === null ? (
        <p style={B.p}>Loading open times…</p>
      ) : slots.length === 0 ? (
        <p style={B.p}>
          No open times right now. Leave James a note on the board and he&apos;ll find one.
        </p>
      ) : (
        <>
          <div style={B.label}>Day</div>
          <div style={B.days}>
            {days.map(([k, iso]) => (
              <button
                key={k}
                className="bk-chip"
                aria-pressed={day === k}
                style={{ ...B.day, ...(day === k ? B.on : {}) }}
                onClick={() => {
                  setDay(k);
                  setPick("");
                }}
              >
                <span style={{ fontSize: 11, opacity: 0.75 }}>
                  {fmt(iso, { weekday: "short" })}
                </span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>
                  {fmt(iso, { day: "numeric" })}
                </span>
                <span style={{ fontSize: 10.5, opacity: 0.7 }}>{fmt(iso, { month: "short" })}</span>
              </button>
            ))}
          </div>
          <div style={B.label}>
            Time{" "}
            <span style={{ textTransform: "none", letterSpacing: 0 }}>
              · {slotMin} minutes, Atlantic time
            </span>
          </div>
          <div style={B.times}>
            {times.map((t) => (
              <button
                key={t}
                className="bk-chip"
                aria-pressed={pick === t}
                style={{ ...B.time, ...(pick === t ? B.on : {}) }}
                onClick={() => setPick(t)}
              >
                {timeOf(t)}
              </button>
            ))}
          </div>
          <div style={B.row}>
            <label style={B.field}>
              <span style={B.label}>{host ? "Their name" : "Your name"}</span>
              <input
                className="bk-in"
                style={B.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
            </label>
            <label style={B.field}>
              <span style={B.label}>{host ? "Their email" : "Your email"}</span>
              <input
                className="bk-in"
                style={B.input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="for the invite"
                maxLength={200}
              />
            </label>
          </div>
          <label style={B.field}>
            <span style={B.label}>Note (optional)</span>
            <input
              className="bk-in"
              style={B.input}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={host ? "What it's about" : "Anything James should know"}
              maxLength={400}
            />
          </label>
          {err && <div style={B.err}>{err}</div>}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 14,
              gap: 10,
            }}
          >
            <span style={{ color: MUTED, fontSize: 12.5 }}>
              {pick ? longWhen(pick) : "Pick a day and a time."}
            </span>
            <button
              style={{ ...B.primary, opacity: busy || !pick ? 0.6 : 1 }}
              disabled={busy || !pick}
              onClick={submit}
            >
              {busy ? "Booking…" : "Book it"}
            </button>
          </div>
        </>
      )}
      <style>{BK_CSS}</style>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// James's Bookings: what's booked, his hours, time away, the Outlook feed
// ---------------------------------------------------------------------------
type Booking = {
  id: string;
  start: string;
  end: string;
  name: string;
  email: string;
  note?: string;
  by: string;
};
type Settings = {
  hours: Record<string, Array<[string, string]>>;
  slotMin: number;
  leadHours: number;
  horizonDays: number;
  blocks: Array<{ id: string; start: string; end: string; note?: string }>;
};
const WEEK = [
  ["1", "Monday"],
  ["2", "Tuesday"],
  ["3", "Wednesday"],
  ["4", "Thursday"],
  ["5", "Friday"],
  ["6", "Saturday"],
  ["0", "Sunday"],
] as const;

export function BookingsDesk({
  getToken,
  onClose,
  onBook,
}: {
  getToken: () => string;
  onClose: () => void;
  onBook: () => void;
}) {
  const [tab, setTab] = useState<"booked" | "hours" | "outlook">("booked");
  const [list, setList] = useState<Booking[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [feed, setFeed] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saved, setSaved] = useState("");
  const [copied, setCopied] = useState(false);
  const [away, setAway] = useState({ date: "", from: "09:00", to: "17:00" });
  const auth = { Authorization: `Bearer ${getToken()}` };

  const load = useCallback(() => {
    fetch(`${API}/office/bookings`, {
      headers: { Authorization: `Bearer ${getToken()}` },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => {
        if (!j?.ok) return setList([]);
        setList(j.bookings || []);
        setSettings(j.settings);
        setFeed(j.feed || "");
      })
      .catch(() => setList([]));
  }, [getToken]);
  useEffect(load, [load]);

  const cancel = async (id: string) => {
    await fetch(`${API}/office/booking/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: auth,
    }).catch(() => {});
    setConfirm("");
    load();
  };
  const save = async (next: Settings, extra: Record<string, unknown> = {}) => {
    setSaved("");
    const r = await fetch(`${API}/office/booking/settings`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ ...next, ...extra }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) {
      setSettings(j.settings);
      setFeed(j.feed || feed);
      setSaved("Saved.");
    } else setSaved("Couldn't save. Try again.");
  };
  const setDay = (d: string, range: [string, string] | null) => {
    if (!settings) return;
    const hours = { ...settings.hours };
    if (range) hours[d] = [range];
    else delete hours[d];
    setSettings({ ...settings, hours });
  };

  return (
    <Modal title="Bookings" onClose={onClose} wide>
      <div style={B.tabs} role="tablist">
        {(
          [
            ["booked", "Booked"],
            ["hours", "Hours & time away"],
            ["outlook", "Outlook"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className="bk-chip"
            style={{ ...B.tab, ...(tab === k ? B.tabOn : {}) }}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button style={B.ghost} onClick={onBook}>
          + Book a follow-up
        </button>
      </div>

      {tab === "booked" &&
        (list === null ? (
          <p style={B.p}>Loading…</p>
        ) : list.length === 0 ? (
          <p style={B.p}>
            Nothing booked yet. Visitors can book from the office; you can book for them from the
            list of who&apos;s in.
          </p>
        ) : (
          <div style={B.table}>
            {list.map((b) => (
              <div key={b.id} style={B.tr}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{longWhen(b.start)}</div>
                  <div
                    style={{
                      color: MUTED,
                      fontSize: 12.5,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {b.name} · {b.email}
                    {b.note ? ` · ${b.note}` : ""}
                  </div>
                </div>
                {confirm === b.id ? (
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ color: MUTED, fontSize: 12 }}>They&apos;ll get an email.</span>
                    <button style={B.danger} onClick={() => cancel(b.id)}>
                      Cancel it
                    </button>
                    <button style={B.ghost} onClick={() => setConfirm("")}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button style={B.ghost} onClick={() => setConfirm(b.id)}>
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}

      {tab === "hours" && settings && (
        <>
          <div style={B.label}>When people can book (Atlantic time)</div>
          <div style={B.table}>
            {WEEK.map(([d, label]) => {
              const r = settings.hours[d]?.[0];
              return (
                <div key={d} style={{ ...B.tr, gridTemplateColumns: "130px 1fr" }}>
                  <label
                    style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={!!r}
                      onChange={(e) => setDay(d, e.target.checked ? ["09:00", "17:00"] : null)}
                    />
                    {label}
                  </label>
                  {r ? (
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        className="bk-in"
                        style={B.timeIn}
                        type="time"
                        value={r[0]}
                        onChange={(e) => setDay(d, [e.target.value, r[1]])}
                      />
                      <span style={{ color: MUTED }}>to</span>
                      <input
                        className="bk-in"
                        style={B.timeIn}
                        type="time"
                        value={r[1]}
                        onChange={(e) => setDay(d, [r[0], e.target.value])}
                      />
                    </span>
                  ) : (
                    <span style={{ color: MUTED }}>Closed</span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ ...B.row, marginTop: 12 }}>
            <label style={B.field}>
              <span style={B.label}>Length</span>
              <select
                className="bk-in"
                style={B.input}
                value={settings.slotMin}
                onChange={(e) => setSettings({ ...settings, slotMin: Number(e.target.value) })}
              >
                {[15, 20, 30, 45, 60, 90].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </label>
            <label style={B.field}>
              <span style={B.label}>Earliest booking</span>
              <select
                className="bk-in"
                style={B.input}
                value={settings.leadHours}
                onChange={(e) => setSettings({ ...settings, leadHours: Number(e.target.value) })}
              >
                {[
                  [2, "2 hours ahead"],
                  [12, "12 hours ahead"],
                  [24, "a day ahead"],
                  [48, "two days ahead"],
                ].map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ ...B.label, marginTop: 16 }}>Time away</div>
          {settings.blocks.length > 0 && (
            <div style={B.table}>
              {settings.blocks.map((b) => (
                <div key={b.id} style={B.tr}>
                  <span>
                    {longWhen(b.start)} to {timeOf(b.end)}
                  </span>
                  <button
                    style={B.ghost}
                    onClick={() =>
                      setSettings({
                        ...settings,
                        blocks: settings.blocks.filter((x) => x.id !== b.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            <input
              className="bk-in"
              style={B.timeIn}
              type="date"
              value={away.date}
              onChange={(e) => setAway({ ...away, date: e.target.value })}
            />
            <input
              className="bk-in"
              style={B.timeIn}
              type="time"
              value={away.from}
              onChange={(e) => setAway({ ...away, from: e.target.value })}
            />
            <span style={{ color: MUTED }}>to</span>
            <input
              className="bk-in"
              style={B.timeIn}
              type="time"
              value={away.to}
              onChange={(e) => setAway({ ...away, to: e.target.value })}
            />
            <button
              style={B.ghost}
              disabled={!away.date || away.from >= away.to}
              onClick={() => {
                setSettings({
                  ...settings,
                  blocks: [
                    ...settings.blocks,
                    {
                      id: `b${settings.blocks.length}-${away.date}`,
                      start: halifaxIso(away.date, away.from),
                      end: halifaxIso(away.date, away.to),
                    },
                  ],
                });
                setAway({ ...away, date: "" });
              }}
            >
              Add time away
            </button>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 10,
              marginTop: 16,
            }}
          >
            <span style={{ color: MUTED, fontSize: 12.5 }}>{saved}</span>
            <button style={B.primary} onClick={() => save(settings)}>
              Save
            </button>
          </div>
        </>
      )}

      {tab === "outlook" && (
        <>
          <p style={B.p}>
            Your follow-ups as a calendar. Add it to Outlook once and every booking shows up there,
            and on any phone where you add the same link.
          </p>
          <ol style={{ ...B.p, paddingLeft: 18 }}>
            <li>In Outlook, open the calendar.</li>
            <li>
              Choose <b>Add calendar</b> (or <b>Open Calendar</b>), then <b>From Internet</b>.
            </li>
            <li>Paste the link below and say yes. New bookings appear within the hour.</li>
          </ol>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="bk-in"
              style={{ ...B.input, flex: 1, fontFamily: "Consolas, monospace", fontSize: 12 }}
              readOnly
              value={feed}
              onFocus={(e) => e.target.select()}
            />
            <button
              style={B.primary}
              onClick={() => {
                navigator.clipboard?.writeText(feed).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                });
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p style={{ ...B.p, fontSize: 12.5, color: MUTED, marginTop: 12 }}>
            The link is the key: anyone with it can see who you&apos;re meeting. If it ever gets
            out,{" "}
            <button style={B.link} onClick={() => settings && save(settings, { newFeedKey: true })}>
              make a new one
            </button>{" "}
            and add that instead.
          </p>
        </>
      )}
      <style>{BK_CSS}</style>
    </Modal>
  );
}

const BK_CSS = `
.bk-chip:hover{border-color:${GOLD}88!important}
.bk-chip:focus-visible,.bk-in:focus-visible{outline:2px solid ${GOLD};outline-offset:1px}
.bk-in:focus{border-color:${GOLD}!important}
`;

const B: Record<string, CSSProperties> = {
  scrim: {
    position: "fixed",
    inset: 0,
    zIndex: 200,
    background: "rgba(4,10,20,.62)",
    display: "grid",
    placeItems: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    borderRadius: 10,
    border: `1px solid ${LINE}`,
    background: "#0B1A2E",
    color: INK,
    fontFamily: UIFONT,
    boxShadow: "0 24px 60px rgba(0,0,0,.5)",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: `1px solid ${LINE}`,
  },
  title: { fontFamily: SERIF, fontSize: 18, color: "#F3E9D2" },
  close: {
    border: 0,
    background: "transparent",
    color: MUTED,
    fontSize: 22,
    lineHeight: 1,
    cursor: "pointer",
  },
  body: { padding: 16, overflowY: "auto" },
  lead: { fontSize: 16, lineHeight: 1.5, margin: "0 0 10px" },
  p: { fontSize: 14, lineHeight: 1.55, margin: "0 0 10px", color: INK },
  label: {
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: ".1em",
    textTransform: "uppercase",
    color: MUTED,
    margin: "10px 0 6px",
    display: "block",
  },
  days: { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 },
  day: {
    flex: "0 0 auto",
    width: 58,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    padding: "7px 0",
    borderRadius: 7,
    border: `1px solid ${LINE}`,
    background: "#0E2138",
    color: INK,
    cursor: "pointer",
  },
  times: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(92px,1fr))", gap: 6 },
  time: {
    padding: "8px 0",
    borderRadius: 7,
    border: `1px solid ${LINE}`,
    background: "#0E2138",
    color: INK,
    fontSize: 13.5,
    cursor: "pointer",
  },
  on: { background: GOLD, borderColor: GOLD, color: "#0B1A2E", fontWeight: 700 },
  row: { display: "flex", gap: 10, flexWrap: "wrap" },
  field: { flex: "1 1 200px", display: "block" },
  input: {
    width: "100%",
    boxSizing: "border-box",
    height: 36,
    padding: "0 10px",
    borderRadius: 7,
    border: `1px solid ${LINE}`,
    background: "#081426",
    color: INK,
    fontSize: 14,
    fontFamily: UIFONT,
  },
  timeIn: {
    height: 32,
    padding: "0 8px",
    borderRadius: 6,
    border: `1px solid ${LINE}`,
    background: "#081426",
    color: INK,
    fontSize: 13,
    colorScheme: "dark",
  },
  err: { color: "#F2A39B", fontSize: 13, marginTop: 10 },
  primary: {
    padding: "8px 18px",
    borderRadius: 7,
    border: `1px solid ${GOLD}`,
    background: GOLD,
    color: "#0B1A2E",
    fontWeight: 700,
    fontSize: 13.5,
    cursor: "pointer",
  },
  ghost: {
    padding: "6px 12px",
    borderRadius: 6,
    border: `1px solid ${LINE}`,
    background: "transparent",
    color: INK,
    fontSize: 12.5,
    cursor: "pointer",
  },
  danger: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #8C3B33",
    background: "#5A231E",
    color: "#fff",
    fontSize: 12.5,
    cursor: "pointer",
  },
  link: {
    border: 0,
    padding: 0,
    background: "transparent",
    color: GOLD,
    textDecoration: "underline",
    cursor: "pointer",
    fontSize: "inherit",
  },
  tabs: { display: "flex", gap: 4, alignItems: "center", marginBottom: 14, flexWrap: "wrap" },
  tab: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid transparent",
    background: "transparent",
    color: MUTED,
    fontSize: 13,
    cursor: "pointer",
  },
  tabOn: { background: "#13294A", color: INK, borderColor: LINE },
  table: { border: `1px solid ${LINE}`, borderRadius: 8, overflow: "hidden" },
  tr: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    borderTop: `1px solid #13294A`,
    fontSize: 13.5,
  },
};
