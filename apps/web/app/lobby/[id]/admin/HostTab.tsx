"use client";

// Admin → Host: the lobby's AI host (James 2026-10-31: "a sarcastic drill
// sergeant who welcomes people and posts the Major Order"). A character who
// lives in the lobby's chat: greets new members, answers when someone writes
// @<its name>, and voices the lobby's scheduled posts (Admin → Automations).
// Described, or set by hand; api routes/lobbyExtras.ts saves it.
import React, { useEffect, useState } from "react";
import { LobbyData, S } from "./shared";
import DescribeBox from "../../../../components/build/DescribeBox";
import { describeJob } from "../../../../lib/aiBuild";
import {
  HOST_OFF,
  extrasErrorText,
  host as hostApi,
  type HostConfig,
} from "../../../../lib/lobbyExtras";

export function HostTab({ lobby }: { lobby: LobbyData }) {
  const [h, setH] = useState<HostConfig>(HOST_OFF);
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const accent = lobby.accentColor || "#7c3aed";

  useEffect(() => {
    hostApi
      .get(lobby.id)
      .then((x) => {
        setH(x);
        setSaved(JSON.stringify(x));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [lobby.id]);

  const set = (p: Partial<HostConfig>) => setH((x) => ({ ...x, ...p }));
  const dirty = JSON.stringify(h) !== saved;

  async function save(next = h) {
    setBusy(true);
    setMsg("");
    try {
      const out = await hostApi.save(lobby.id, next);
      setH(out);
      setSaved(JSON.stringify(out));
      setMsg(out.on ? `Saved. ${out.name} is in the chat.` : "Saved. The host is off.");
    } catch (e) {
      setMsg(extrasErrorText(e));
    }
    setBusy(false);
  }

  if (loading) return <div style={{ opacity: 0.4, fontSize: 13 }}>Loading…</div>;

  const lines = h.welcomeLines.length ? h.welcomeLines : [""];
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={S.sectionTitle}>Your lobby&apos;s host</div>
      <div style={{ fontSize: 12, opacity: 0.6, margin: "-4px 0 14px", lineHeight: 1.55 }}>
        A character who lives in your lobby&apos;s chat. It says hello to new members, answers when
        someone writes @{h.name || "its name"}, and posts your scheduled messages in its own voice.
        Its answers come out of each person&apos;s daily Operator questions.
      </div>

      <DescribeBox
        kind="host"
        accent={accent}
        className="db-in-tab"
        label="Describe your host"
        placeholder="A sarcastic drill sergeant who welcomes recruits and posts the Major Order"
        onBuild={async (prompt) => {
          const j = await describeJob<HostConfig>("host", prompt, { lobbyId: lobby.id });
          const before = h;
          setH({ ...j.result, on: true });
          setMsg("");
          return {
            summary: `${j.summary || "Meet your host."} Save to bring them in.`,
            undo: () => setH(before),
          };
        }}
      />

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          margin: "4px 0 12px",
        }}
      >
        <input type="checkbox" checked={h.on} onChange={(e) => set({ on: e.target.checked })} />
        The host is {h.on ? "on" : "off"}
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0,1fr)", gap: 10 }}>
        <div>
          <div style={S.label}>Face</div>
          <input
            style={{ ...S.input, textAlign: "center", fontSize: 18 }}
            value={h.emoji}
            maxLength={8}
            placeholder="🎖️"
            onChange={(e) => set({ emoji: e.target.value })}
          />
        </div>
        <div>
          <div style={S.label}>Name (people write @{h.name || "Name"})</div>
          <input
            style={S.input}
            value={h.name}
            maxLength={32}
            placeholder="Sarge"
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
      </div>

      <div style={{ ...S.label, marginTop: 12 }}>Who they are and how they talk</div>
      <textarea
        style={{ ...S.input, resize: "vertical", fontFamily: "inherit" }}
        rows={4}
        maxLength={800}
        value={h.persona}
        placeholder="You are Sarge, a gruff but fair drill sergeant…"
        onChange={(e) => set({ persona: e.target.value })}
      />

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          margin: "14px 0 6px",
        }}
      >
        <input
          type="checkbox"
          checked={h.welcome}
          onChange={(e) => set({ welcome: e.target.checked })}
        />
        Say hello to new members
      </label>
      {h.welcome && (
        <>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 6 }}>
            One is picked at random. {"{name}"} becomes the newcomer&apos;s name.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {lines.map((l, i) => (
              <div key={i} style={{ display: "flex", gap: 6 }}>
                <input
                  style={S.input}
                  value={l}
                  maxLength={160}
                  placeholder="Welcome to the squad, {name}. Drop and give me twenty."
                  onChange={(e) => {
                    const next = [...lines];
                    next[i] = e.target.value;
                    set({ welcomeLines: next });
                  }}
                />
                <button
                  type="button"
                  style={S.btn}
                  onClick={() => set({ welcomeLines: lines.filter((_, j) => j !== i) })}
                  aria-label="Remove this greeting"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {lines.length < 6 && (
            <button
              type="button"
              style={{ ...S.btn, marginTop: 6 }}
              onClick={() => set({ welcomeLines: [...lines, ""] })}
            >
              + Another greeting
            </button>
          )}
          {h.welcomeLines.some((l) => l.trim() && !l.includes("{name}")) && (
            <div style={{ fontSize: 11, color: "rgb(253,230,138)", marginTop: 6 }}>
              Greetings without {"{name}"} aren&apos;t used.
            </div>
          )}
        </>
      )}

      {h.on && h.name && (
        <div style={{ ...S.card, marginTop: 16, fontSize: 13, lineHeight: 1.5 }}>
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 6 }}>How it looks in chat</div>
          <b style={{ color: "#c4b5fd" }}>
            {h.emoji} {h.name}
          </b>{" "}
          {(
            h.welcomeLines.find((l) => l.includes("{name}")) || "Hey {name}, welcome in."
          ).replaceAll("{name}", "Raven")}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
        <button
          style={{ ...S.btnPri, padding: "8px 20px" }}
          onClick={() => save()}
          disabled={busy || !dirty || (h.on && (!h.name.trim() || !h.persona.trim()))}
        >
          {busy ? "Saving…" : "Save the host"}
        </button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>
    </div>
  );
}
