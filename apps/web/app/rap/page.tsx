"use client";

// weered.ca/rap: fill in your rap sheet (2026-11-01, the GTA VI launch). The card
// draws itself below as you go; saving gives you the link to share. The choices
// come from the API (routes/rapSheet.ts), so they're defined once.
import React, { useEffect, useMemo, useState } from "react";
import RapSheetCard from "../../components/rap/RapSheetCard";
import { rapLink, rapPath, type RapChoices, type RapSheet } from "../../lib/rapSheet";
import { whoIsHere } from "../../lib/hasAccount";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#ff4d9d";

type Draft = {
  playstyles: string[];
  hours: string[];
  showZone: boolean;
  mic: string;
  lookingFor: string;
  motto: string;
  psn: string;
  xbox: string;
};

const CSS = `
.rap-ed { max-width: 860px; margin: 0 auto; }
.rap-ed h1 { font-size: 30px; font-weight: 900; margin: 0 0 6px; letter-spacing: -.5px; }
.rap-ed .sub { opacity: .65; margin: 0 0 22px; font-size: 15px; line-height: 1.5; }
.rap-field { margin-bottom: 20px; }
.rap-field > label, .rap-field > .lbl { display: block; font-size: 12px; font-weight: 800; letter-spacing: .12em; opacity: .6; margin-bottom: 8px; }
.rap-opts { display: flex; flex-wrap: wrap; gap: 8px; }
.rap-opt { padding: 8px 13px; border-radius: 999px; font-size: 14px; font-weight: 700; cursor: pointer;
  background: rgba(255,255,255,.05); color: inherit; border: 1px solid rgba(255,255,255,.14); }
.rap-opt[aria-pressed="true"] { background: ${ACCENT}; border-color: ${ACCENT}; color: #0b0b0f; }
.rap-opt:disabled { opacity: .35; cursor: default; }
.rap-in { width: 100%; box-sizing: border-box; padding: 11px 13px; border-radius: 10px; font-size: 15px; color: inherit;
  background: rgba(0,0,0,.3); border: 1px solid rgba(255,255,255,.16); outline: none; }
.rap-in:focus { border-color: ${ACCENT}; }
.rap-two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 640px) { .rap-two { grid-template-columns: 1fr; } .rap-ed h1 { font-size: 24px; } }
.rap-save { position: sticky; bottom: 0; z-index: 2; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
  padding: 14px 0; margin: 8px 0 26px; background: linear-gradient(to top, var(--weered-bg, #080810) 70%, transparent); }
.rap-go { padding: 12px 22px; border-radius: 12px; border: 0; background: ${ACCENT}; color: #0b0b0f; font-weight: 900; font-size: 15px; cursor: pointer; }
.rap-go:hover:not(:disabled) { background: #ff6aad; } /* outranks the site's button:hover grey */
.rap-go:disabled { opacity: .5; cursor: default; }
.rap-ghost { padding: 11px 16px; border-radius: 12px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14);
  color: inherit; font-weight: 800; font-size: 14px; cursor: pointer; text-decoration: none; }
`;

function browserZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

export default function RapSheetEditor() {
  const [state, setState] = useState<"loading" | "signed_out" | "no_account" | "ready" | "error">(
    "loading",
  );
  const [sheet, setSheet] = useState<RapSheet | null>(null);
  const [choices, setChoices] = useState<RapChoices | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const zone = useMemo(browserZone, []);

  useEffect(() => {
    // Nobody signed in, or a guest: the answer is known without asking, and
    // asking was a refused call (lib/hasAccount.ts).
    const here = whoIsHere();
    if (here !== "account") {
      setState(here === "guest" ? "no_account" : "signed_out");
      return;
    }
    fetch(`${API}/rapsheet/me`, { credentials: "include" })
      .then(async (r) => {
        if (r.status === 401) return setState("signed_out");
        const j = await r.json().catch(() => null);
        if (r.status === 403) return setState("no_account");
        if (!j?.ok) return setState("error");
        const s: RapSheet = j.sheet;
        setSheet(s);
        setChoices(j.choices);
        setDraft({
          playstyles: s.playstyles,
          hours: s.hours,
          showZone: s.filed ? !!s.timezone : true,
          mic: s.mic,
          lookingFor: s.lookingFor,
          motto: s.motto,
          psn: s.handles.psn || "",
          xbox: s.handles.xbox || "",
        });
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  // The card as it will look once saved.
  const preview: RapSheet | null = useMemo(() => {
    if (!sheet || !draft || !choices) return null;
    return {
      ...sheet,
      filed: true,
      playstyles: draft.playstyles,
      hours: draft.hours,
      timezone: draft.showZone ? zone : "",
      mic: draft.mic,
      lookingFor: draft.lookingFor,
      micLabel: choices.mic.find((c) => c.id === draft.mic)?.label || "",
      lookingForLabel: choices.lookingFor.find((c) => c.id === draft.lookingFor)?.label || "",
      motto: draft.motto.trim(),
      handles: { psn: draft.psn.trim() || null, xbox: draft.xbox.trim() || null },
    };
  }, [sheet, draft, choices, zone]);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setMsg(null);
  };
  const toggle = (key: "playstyles" | "hours", v: string) => {
    if (!draft) return;
    const cur = draft[key];
    set({ [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as Partial<Draft>);
  };

  async function save() {
    if (!draft || !sheet || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      // Xbox first: Xbox checks the gamertag exists (api /profile/me/xbox-gamertag).
      let xboxError = "";
      if (draft.xbox.trim() !== (sheet.handles.xbox || "")) {
        const r = await fetch(`${API}/profile/me/xbox-gamertag`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gamertag: draft.xbox.trim() }),
        });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) xboxError = j?.message || "That Xbox gamertag didn't check out.";
      }
      const r = await fetch(`${API}/rapsheet`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playstyles: draft.playstyles,
          hours: draft.hours,
          timezone: draft.showZone ? zone : "",
          mic: draft.mic,
          lookingFor: draft.lookingFor,
          motto: draft.motto,
          psn: draft.psn,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        setMsg({ ok: false, text: j?.message || "That didn't save. Try again in a moment." });
        return;
      }
      setSheet(j.sheet);
      set({ psn: j.sheet.handles.psn || "", xbox: j.sheet.handles.xbox || "" });
      setMsg(
        xboxError
          ? { ok: false, text: `Saved, but not the Xbox gamertag: ${xboxError}` }
          : { ok: true, text: "Filed. Your rap sheet is live." },
      );
    } catch {
      setMsg({ ok: false, text: "That didn't save. Try again in a moment." });
    } finally {
      setSaving(false);
    }
  }

  const copy = async () => {
    if (!sheet) return;
    try {
      await navigator.clipboard.writeText(rapLink(sheet));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const page = (children: React.ReactNode) => (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px 16px 40px",
        background: "var(--weered-bg, #080810)",
        color: "rgba(243,244,246,.92)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <style>{CSS}</style>
      <div className="rap-ed">
        <div style={{ marginBottom: 22 }}>
          <a
            href="/home"
            style={{ color: "inherit", textDecoration: "none", fontWeight: 900, fontSize: 18 }}
          >
            weered
          </a>
        </div>
        {children}
      </div>
    </main>
  );

  if (state === "loading") return page(<p style={{ opacity: 0.5 }}>Pulling your file…</p>);
  if (state === "signed_out" || state === "no_account")
    return page(
      <>
        <h1>Your rap sheet</h1>
        <p className="sub">
          One card with your crew, your PSN and Xbox handles, how you play and when you&apos;re on.
          One link to drop in any Discord, subreddit or group chat. Free, with a Weered account.
        </p>
        <a
          className="rap-go"
          href={`/login?next=${encodeURIComponent("/rap")}`}
          style={{ display: "inline-block", textDecoration: "none" }}
        >
          {state === "no_account" ? "Make a Weered account" : "Sign in to make yours"}
        </a>
      </>,
    );
  if (state === "error" || !draft || !choices || !preview || !sheet)
    return page(
      <p style={{ opacity: 0.7 }}>Your file wouldn&apos;t open. Refresh to try again.</p>,
    );

  const atMax = (key: "playstyles" | "hours") =>
    draft[key].length >= (key === "playstyles" ? choices.playstylesMax : choices.hoursMax);

  return page(
    <>
      <h1>Your rap sheet</h1>
      <p className="sub">
        The card crews look at before they take you on. Fill in what you like; rank, crew and priors
        come from Weered.
      </p>

      <div className="rap-two">
        <div className="rap-field">
          <label htmlFor="rap-psn">PSN ID</label>
          <input
            id="rap-psn"
            className="rap-in"
            value={draft.psn}
            maxLength={16}
            placeholder="Your PlayStation online ID"
            onChange={(e) => set({ psn: e.target.value })}
          />
        </div>
        <div className="rap-field">
          <label htmlFor="rap-xbox">Xbox gamertag</label>
          <input
            id="rap-xbox"
            className="rap-in"
            value={draft.xbox}
            maxLength={20}
            placeholder="Checked with Xbox when you save"
            onChange={(e) => set({ xbox: e.target.value })}
          />
        </div>
      </div>

      <div className="rap-field">
        <div className="lbl">M.O. · up to {choices.playstylesMax}</div>
        <div className="rap-opts">
          {choices.playstyles.map((p) => {
            const on = draft.playstyles.includes(p);
            return (
              <button
                key={p}
                type="button"
                className="rap-opt"
                aria-pressed={on}
                disabled={!on && atMax("playstyles")}
                onClick={() => toggle("playstyles", p)}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rap-field">
        <div className="lbl">When you&apos;re on · up to {choices.hoursMax}</div>
        <div className="rap-opts">
          {choices.hours.map((h) => {
            const on = draft.hours.includes(h);
            return (
              <button
                key={h}
                type="button"
                className="rap-opt"
                aria-pressed={on}
                disabled={!on && atMax("hours")}
                onClick={() => toggle("hours", h)}
              >
                {h}
              </button>
            );
          })}
        </div>
        {zone && (
          <label
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginTop: 10,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={draft.showZone}
              onChange={(e) => set({ showZone: e.target.checked })}
            />
            Show my time zone ({zone.split("/").pop()?.replace(/_/g, " ")})
          </label>
        )}
      </div>

      <div className="rap-two">
        <div className="rap-field">
          <div className="lbl">Mic</div>
          <div className="rap-opts">
            {choices.mic.map((c) => (
              <button
                key={c.id}
                type="button"
                className="rap-opt"
                aria-pressed={draft.mic === c.id}
                onClick={() => set({ mic: draft.mic === c.id ? "" : c.id })}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rap-field">
          <div className="lbl">Looking for</div>
          <div className="rap-opts">
            {choices.lookingFor.map((c) => (
              <button
                key={c.id}
                type="button"
                className="rap-opt"
                aria-pressed={draft.lookingFor === c.id}
                onClick={() => set({ lookingFor: draft.lookingFor === c.id ? "" : c.id })}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rap-field">
        <label htmlFor="rap-motto">Last words · one line</label>
        <input
          id="rap-motto"
          className="rap-in"
          value={draft.motto}
          maxLength={choices.mottoMax}
          placeholder="Never met a heist I didn't like"
          onChange={(e) => set({ motto: e.target.value })}
        />
      </div>

      <div className="rap-save">
        <button type="button" className="rap-go" onClick={save} disabled={saving}>
          {saving ? "Filing…" : sheet.filed ? "Save" : "File my rap sheet"}
        </button>
        {sheet.filed && (
          <>
            <a className="rap-ghost" href={rapPath(sheet)}>
              View it
            </a>
            <button type="button" className="rap-ghost" onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </button>
          </>
        )}
        {msg && (
          <span
            role="status"
            style={{ fontSize: 14, fontWeight: 700, color: msg.ok ? "#86efac" : "#fca5a5" }}
          >
            {msg.text}
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: ".12em",
          opacity: 0.5,
          margin: "0 0 10px",
        }}
      >
        PREVIEW
      </div>
      <RapSheetCard sheet={preview} linkCrew={false} />
    </>,
  );
}
