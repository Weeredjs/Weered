"use client";
// "I need a meeting": the custom-build ask for businesses. It posts a private
// kind:"meeting" request (never on the public board) and the API emails staff.
// Opens itself when the URL carries ?meeting=1 or #meeting.
import Link from "next/link";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useWeered } from "./WeeredProvider";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const SIZES = ["Just me", "2–10", "11–50", "51–250", "250+"];

const field: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(0,0,0,.35)",
  color: "#fff",
  fontSize: 14,
  fontFamily: "inherit",
};
const label: CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "1px",
  textTransform: "uppercase",
  color: "rgba(255,255,255,.55)",
  marginBottom: 6,
};

export default function MeetingRequest({ lobbyId }: { lobbyId?: string }) {
  const { me } = useWeered();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [size, setSize] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  // Signed-in test from localStorage: the provider fills `me` after mount.
  const [hasUser, setHasUser] = useState(false);
  useEffect(() => {
    try {
      const authed = !!JSON.parse(localStorage.getItem("weered_user") || "null")?.id;
      setHasUser(authed);
      const u = new URL(window.location.href);
      if (u.searchParams.get("meeting") === "1" || u.hash === "#meeting") {
        if (authed) setOpen(true);
        document.getElementById("meeting")?.scrollIntoView({ block: "start" });
      }
    } catch {}
  }, []);

  useEffect(() => {
    const e = (me as any)?.email;
    if (e && !contact) setContact(String(e));
  }, [me, contact]);

  const signedIn = !!me?.id || hasUser;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (title.trim().length < 2) return setErr("Say what you need in a few words.");
    if (!contact.trim()) return setErr("Leave an email or phone so we can reach you.");
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`${API}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "meeting",
          title: title.trim(),
          company: company.trim(),
          contact: contact.trim(),
          size,
          note: note.trim(),
          lobbyId,
        }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setDone(true);
      else if (r.status === 401) setErr("Sign in first.");
      else if (j?.error === "slow_down") setErr("That's a lot of asks today. Try tomorrow.");
      else setErr("Didn't send. Try again.");
    } catch {
      setErr("Didn't send. Try again.");
    }
    setBusy(false);
  }

  return (
    <section
      id="meeting"
      aria-label="Request a meeting"
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 16,
        padding: "clamp(18px, 4vw, 26px)",
        marginBottom: 24,
        border: "1px solid #a78bfa59",
        background:
          "radial-gradient(120% 140% at 0% 0%, #7c3aed47, transparent 55%), radial-gradient(90% 120% at 100% 100%, rgba(14,165,233,.16), transparent 60%), rgba(8,8,16,.92)",
        color: "#fff",
        scrollMarginTop: 80,
        // Hex, not rgba(124,58,237…): the site themes retint inline purples.
      }}
    >
      {done ? (
        <div role="status">
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.4px" }}>Got it.</div>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,.72)", fontSize: 14.5 }}>
            We&apos;ll reach out to set a time.
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0, flex: "1 1 280px" }}>
              <div
                style={{
                  fontSize: "clamp(20px, 4vw, 26px)",
                  fontWeight: 900,
                  letterSpacing: "-0.5px",
                  color: "#fff",
                }}
              >
                Need something built?
              </div>
              <p
                style={{
                  margin: "6px 0 0",
                  color: "rgba(255,255,255,.7)",
                  fontSize: 14.5,
                  lineHeight: 1.45,
                }}
              >
                Custom modules for your business, wired into your own space. Built to order.
              </p>
            </div>
            {!open &&
              (signedIn ? (
                <button type="button" onClick={() => setOpen(true)} style={cta}>
                  I need a meeting
                </button>
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent("/requests?meeting=1")}`}
                  style={{
                    ...cta,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  I need a meeting
                </Link>
              ))}
          </div>

          {open && (
            <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 18 }}>
              <div>
                <label htmlFor="mr-title" style={label}>
                  What do you need?
                </label>
                <input
                  id="mr-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                  placeholder="e.g. A client portal with our case data"
                  style={field}
                  autoFocus
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                <div>
                  <label htmlFor="mr-company" style={label}>
                    Company
                  </label>
                  <input
                    id="mr-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value.slice(0, 120))}
                    style={field}
                  />
                </div>
                <div>
                  <label htmlFor="mr-contact" style={label}>
                    Email or phone
                  </label>
                  <input
                    id="mr-contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value.slice(0, 200))}
                    style={field}
                  />
                </div>
              </div>
              <div>
                <span style={label}>Team size</span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={size === s}
                      onClick={() => setSize(size === s ? "" : s)}
                      style={{
                        minHeight: 38,
                        padding: "0 14px",
                        borderRadius: 999,
                        border: `1px solid ${size === s ? "#a78bfa" : "rgba(255,255,255,.14)"}`,
                        background: size === s ? "#7c3aed59" : "rgba(255,255,255,.04)",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="mr-note" style={label}>
                  Anything else
                </label>
                <textarea
                  id="mr-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 1500))}
                  rows={3}
                  style={{ ...field, resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button type="submit" disabled={busy} style={{ ...cta, opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Sending…" : "Send it"}
                </button>
                <span role="status" style={{ fontSize: 13, color: "rgba(252,165,165,.95)" }}>
                  {err}
                </span>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}

const cta: CSSProperties = {
  minHeight: 46,
  padding: "0 22px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.18)",
  background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
  boxShadow: "0 10px 30px #7c3aed59, inset 0 1px 0 rgba(255,255,255,.18)",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14.5,
  letterSpacing: ".2px",
  cursor: "pointer",
  fontFamily: "inherit",
  flex: "0 0 auto",
};
