"use client";

import React from "react";
import { onActivate } from "@/lib/a11y";

const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
const ACCENT = "#a78bfa";

function authHeaders(): Record<string, string> {
  try {
    const t = localStorage.getItem("weered_token") || "";
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

function toLocalDt(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateFlairContestModal({
  lobbyId,
  onClose,
  onSaved,
}: {
  lobbyId: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const now = new Date();
  const subClose = new Date(now.getTime() + 7 * 24 * 3600_000);
  const voteOpen = new Date(subClose.getTime());
  const voteClose = new Date(voteOpen.getTime() + 3 * 24 * 3600_000);

  const [title, setTitle] = React.useState("");
  const [theme, setTheme] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [kind, setKind] = React.useState<"BADGE" | "BANNER" | "NAMEPLATE">("BANNER");
  const [submissionOpensAt, setSubOpens] = React.useState(toLocalDt(now));
  const [submissionClosesAt, setSubCloses] = React.useState(toLocalDt(subClose));
  const [voteOpensAt, setVoteOpens] = React.useState(toLocalDt(voteOpen));
  const [voteClosesAt, setVoteCloses] = React.useState(toLocalDt(voteClose));
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");

  async function submit() {
    setErr("");
    setBusy(true);
    try {
      const body = {
        lobbyId,
        title: title.trim(),
        theme: theme.trim(),
        description: description.trim(),
        kind,
        submissionOpensAt: new Date(submissionOpensAt).toISOString(),
        submissionClosesAt: new Date(submissionClosesAt).toISOString(),
        voteOpensAt: new Date(voteOpensAt).toISOString(),
        voteClosesAt: new Date(voteClosesAt).toISOString(),
      };
      const r = await fetch(`${API}/flair-contests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        setErr(j?.error || "Failed to create");
        return;
      }
      onSaved(j.contest.id);
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  const valid = title.trim().length >= 3;

  return (
    <div
      onClick={onClose}
      onKeyDown={onActivate(() => onClose())}
      tabIndex={0}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(8,5,16,.85)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
        role="button"
        tabIndex={0}
        style={{
          width: "min(560px, 100%)",
          padding: 20,
          background: "linear-gradient(180deg, rgba(28,20,48,.97), rgba(14,10,28,.99))",
          border: "2px solid rgba(167,139,250,.5)",
          borderRadius: 6,
          color: "rgba(255,255,255,.92)",
          fontFamily: "inherit",
          maxHeight: "90vh",
          overflow: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: ACCENT,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            New Design Contest
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: 3,
              color: "rgba(255,255,255,.7)",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ✕
          </button>
        </div>

        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            placeholder="Crew Banner — Spring Open"
            style={inputS}
          />
        </Field>
        <Field label="Theme">
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value.slice(0, 200))}
            placeholder="What should artists design around?"
            style={inputS}
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
            placeholder="Rules, sizing notes, anything else."
            rows={3}
            style={{ ...inputS, resize: "vertical" }}
          />
        </Field>

        <Field label="Kind">
          <div style={{ display: "flex", gap: 6 }}>
            {(["BADGE", "BANNER", "NAMEPLATE"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  background: kind === k ? `${ACCENT}33` : "rgba(255,255,255,.04)",
                  border: `1px solid ${kind === k ? ACCENT : "rgba(255,255,255,.1)"}`,
                  color: kind === k ? "#fff" : "rgba(255,255,255,.7)",
                  borderRadius: 3,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Submissions Open">
            <input
              type="datetime-local"
              value={submissionOpensAt}
              onChange={(e) => setSubOpens(e.target.value)}
              style={inputS}
            />
          </Field>
          <Field label="Submissions Close">
            <input
              type="datetime-local"
              value={submissionClosesAt}
              onChange={(e) => setSubCloses(e.target.value)}
              style={inputS}
            />
          </Field>
          <Field label="Voting Opens">
            <input
              type="datetime-local"
              value={voteOpensAt}
              onChange={(e) => setVoteOpens(e.target.value)}
              style={inputS}
            />
          </Field>
          <Field label="Voting Closes">
            <input
              type="datetime-local"
              value={voteClosesAt}
              onChange={(e) => setVoteCloses(e.target.value)}
              style={inputS}
            />
          </Field>
        </div>

        {err && (
          <div
            style={{
              marginTop: 10,
              padding: 8,
              background: "rgba(185,28,28,.18)",
              border: "1px solid rgba(239,68,68,.4)",
              color: "#fca5a5",
              fontSize: 11,
              borderRadius: 3,
            }}
          >
            {err}
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy || !valid}
          style={{
            width: "100%",
            marginTop: 14,
            padding: "12px",
            background:
              valid && !busy
                ? `linear-gradient(135deg, ${ACCENT} 0%, #c4b5fd 100%)`
                : "rgba(255,255,255,.06)",
            color: valid && !busy ? "#1e1b3a" : "rgba(255,255,255,.4)",
            border: `1px solid ${valid && !busy ? ACCENT : "rgba(255,255,255,.1)"}`,
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: "uppercase",
            cursor: valid && !busy ? "pointer" : "default",
            fontFamily: "inherit",
          }}
        >
          {busy ? "Creating..." : "Create Contest"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 1.4,
          color: "rgba(196,181,253,.7)",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

const inputS: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "rgba(10,8,16,.6)",
  border: "1px solid rgba(167,139,250,.3)",
  color: "rgba(255,255,255,.95)",
  borderRadius: 3,
  fontSize: 12,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};
