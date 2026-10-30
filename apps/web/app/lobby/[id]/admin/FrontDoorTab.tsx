"use client";

// Admin → Front door: what a visitor gets through before joining (James
// 2026-10-30: "the entry overlays for lobbies, rules, other questions, gates").
// A welcome, the rules to accept, up to five questions, and gates. Saved into
// the lobby's layout (lib/lobbyLayout.ts LobbyDoor); drawn for visitors by
// components/LobbyDoor.tsx; enforced on join by the API (lib/lobbyDoor.ts),
// which keeps the answers for Join requests and Members.
import React, { useMemo, useState } from "react";
import { LobbyData, S, apiFetch } from "./shared";
import LobbyDoor from "../../../../components/LobbyDoor";
import {
  DOOR_MAX,
  emptyDoor,
  sanitizeDoor,
  sanitizeLayout,
  stockLayout,
  type DoorQuestion,
  type LobbyDoor as Door,
} from "../../../../lib/lobbyLayout";

const MODE_WORDS: Record<string, string> = {
  OPEN: "Open: once through the door, they're in.",
  APPROVAL: "Approval: the door sends you a request with their answers to approve.",
  PASSWORD: "Password: they also need the lobby password.",
  PAID: "Paid: they pick a tier at the door. Questions aren't asked for paid joins.",
};

const HOUSE_RULES = ["Be decent to each other.", "No spam or self-promotion.", "Keep it on topic."];

const newQuestion = (): DoorQuestion => ({
  id: `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
  q: "",
  kind: "text",
  options: [],
  required: true,
});

function Switch({
  on,
  onClick,
  label,
  hint,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      style={{
        ...S.card,
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        color: "inherit",
        border: on ? "1px solid rgba(16,185,129,.35)" : "1px solid rgba(255,255,255,.08)",
        background: on ? "rgba(16,185,129,.06)" : "rgba(255,255,255,.03)",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "relative",
          flexShrink: 0,
          width: 38,
          height: 22,
          borderRadius: 999,
          background: on ? "rgba(16,185,129,.55)" : "rgba(255,255,255,.12)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: on ? 19 : 3,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "#fff",
            transition: "left .15s",
          }}
        />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 700 }}>{label}</span>
        {hint && (
          <span style={{ display: "block", fontSize: 11, opacity: 0.55, marginTop: 2 }}>
            {hint}
          </span>
        )}
      </span>
    </button>
  );
}

export function FrontDoorTab({ lobby, onRefresh }: { lobby: LobbyData; onRefresh: () => void }) {
  const saved = useMemo(() => sanitizeLayout(lobby.layout)?.door || emptyDoor(), [lobby.layout]);
  // Kept as typed; cleaned once, on save (cleaning per keystroke ate spaces).
  const [d, setD] = useState<Door>(saved);
  const [optText, setOptText] = useState<Record<string, string>>(() =>
    Object.fromEntries(saved.questions.map((q) => [q.id, q.options.join(", ")])),
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState(false);

  React.useEffect(() => {
    setD(saved);
    setOptText(Object.fromEntries(saved.questions.map((q) => [q.id, q.options.join(", ")])));
  }, [saved]);

  const set = (patch: Partial<Door>) => setD((x) => ({ ...x, ...patch }));
  const setQ = (id: string, patch: Partial<DoorQuestion>) =>
    set({ questions: d.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });

  /** The door as it will be saved: options from their text, then cleaned. */
  const built = (): Door =>
    sanitizeDoor({
      ...d,
      questions: d.questions.map((q) => ({
        ...q,
        options: (optText[q.id] || "").split(",").map((o) => o.trim()),
      })),
    }) || emptyDoor();

  const dirty = JSON.stringify(built()) !== JSON.stringify(sanitizeDoor(saved) || emptyDoor());
  const dropped = d.questions.filter(
    (q) =>
      q.q.trim() &&
      q.kind === "choice" &&
      (optText[q.id] || "").split(",").filter((o) => o.trim()).length < 2,
  );

  async function save() {
    setSaving(true);
    setMsg("");
    const layout = { ...(sanitizeLayout(lobby.layout) || stockLayout()), door: built() };
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/design`, {
      method: "PATCH",
      body: JSON.stringify({ layout }),
    });
    setSaving(false);
    setMsg(j.ok ? "Saved. Visitors meet the new door now." : j.message || j.error || "Failed.");
    if (j.ok) onRefresh();
  }

  const mode = (lobby.joinMode || "OPEN").toUpperCase();
  const row: React.CSSProperties = { display: "flex", gap: 6, alignItems: "center" };
  const small: React.CSSProperties = { ...S.btn, padding: "6px 10px", fontSize: 12 };

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={S.sectionTitle}>Front door</div>
      <div style={{ fontSize: 12, opacity: 0.6, margin: "-4px 0 12px", lineHeight: 1.5 }}>
        What someone gets through before they join: your welcome, the rules, a few questions, and
        who&apos;s allowed in. Members never see it again.
      </div>

      <Switch
        on={d.on}
        onClick={() => set({ on: !d.on })}
        label={d.on ? "The front door is on" : "The front door is off"}
        hint="Off: people join with one click, as before."
      />

      <div style={{ opacity: d.on ? 1 : 0.45, pointerEvents: d.on ? "auto" : "none" }}>
        <div style={{ ...S.sectionTitle, marginTop: 22 }}>Welcome</div>
        <div style={S.label}>Headline</div>
        <input
          value={d.title}
          maxLength={DOOR_MAX.title}
          placeholder={`Welcome to ${lobby.name || lobby.id}`}
          onChange={(e) => set({ title: e.target.value })}
          style={S.input}
        />
        <div style={{ ...S.label, marginTop: 12 }}>Message</div>
        <textarea
          value={d.body}
          maxLength={DOOR_MAX.body}
          rows={4}
          placeholder="Who you are, what happens here, when people get together."
          onChange={(e) => set({ body: e.target.value })}
          style={{ ...S.input, resize: "vertical", fontFamily: "inherit" }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)",
            gap: 10,
            marginTop: 12,
          }}
        >
          <div>
            <div style={S.label}>Picture (https link)</div>
            <input
              value={d.image}
              placeholder="Empty: the lobby's banner"
              onChange={(e) => set({ image: e.target.value })}
              style={S.input}
            />
          </div>
          <div>
            <div style={S.label}>Button</div>
            <input
              value={d.button}
              maxLength={DOOR_MAX.button}
              placeholder="Come in"
              onChange={(e) => set({ button: e.target.value })}
              style={S.input}
            />
          </div>
        </div>

        <div style={{ ...S.sectionTitle, marginTop: 22 }}>Rules</div>
        <div style={{ fontSize: 11.5, opacity: 0.55, marginBottom: 8 }}>
          Visitors tick &quot;I&apos;ll follow them&quot; to get in. Leave empty for no rules.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {d.rules.map((r, i) => (
            <div key={i} style={row}>
              <span style={{ width: 18, fontSize: 12, opacity: 0.5, textAlign: "right" }}>
                {i + 1}.
              </span>
              <input
                value={r}
                maxLength={DOOR_MAX.rule}
                onChange={(e) =>
                  set({ rules: d.rules.map((x, j) => (j === i ? e.target.value : x)) })
                }
                style={S.input}
              />
              <button
                type="button"
                aria-label="Move up"
                disabled={i === 0}
                onClick={() => {
                  const next = [...d.rules];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  set({ rules: next });
                }}
                style={{ ...small, opacity: i === 0 ? 0.35 : 1 }}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Remove rule"
                onClick={() => set({ rules: d.rules.filter((_, j) => j !== i) })}
                style={small}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div style={{ ...row, marginTop: 8 }}>
          <button
            type="button"
            disabled={d.rules.length >= DOOR_MAX.rules}
            onClick={() => set({ rules: [...d.rules, ""] })}
            style={small}
          >
            + Add a rule
          </button>
          {d.rules.length === 0 && (
            <button type="button" onClick={() => set({ rules: [...HOUSE_RULES] })} style={small}>
              Start with house rules
            </button>
          )}
        </div>

        <div style={{ ...S.sectionTitle, marginTop: 22 }}>Questions</div>
        <div style={{ fontSize: 11.5, opacity: 0.55, marginBottom: 8 }}>
          Up to {DOOR_MAX.questions}. You&apos;ll see the answers under Members, and under Join
          requests when the lobby asks to approve people.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {d.questions.map((q) => (
            <div key={q.id} style={{ ...S.card, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={row}>
                <input
                  value={q.q}
                  maxLength={DOOR_MAX.q}
                  placeholder="What's your in-game name?"
                  onChange={(e) => setQ(q.id, { q: e.target.value })}
                  style={S.input}
                />
                <button
                  type="button"
                  aria-label="Remove question"
                  onClick={() => set({ questions: d.questions.filter((x) => x.id !== q.id) })}
                  style={small}
                >
                  ✕
                </button>
              </div>
              <div style={{ ...row, flexWrap: "wrap" }}>
                {(["text", "choice"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={q.kind === k}
                    onClick={() => setQ(q.id, { kind: k })}
                    style={{
                      ...small,
                      ...(q.kind === k
                        ? {
                            background: "rgba(16,185,129,.14)",
                            border: "1px solid rgba(16,185,129,.45)",
                          }
                        : {}),
                    }}
                  >
                    {k === "text" ? "Short answer" : "Pick one"}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={q.required}
                  onClick={() => setQ(q.id, { required: !q.required })}
                  style={small}
                >
                  {q.required ? "● Required" : "○ Optional"}
                </button>
              </div>
              {q.kind === "choice" && (
                <input
                  value={optText[q.id] || ""}
                  placeholder="Choices, separated by commas: PC, PlayStation, Xbox"
                  onChange={(e) => setOptText((o) => ({ ...o, [q.id]: e.target.value }))}
                  style={S.input}
                />
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={d.questions.length >= DOOR_MAX.questions}
          onClick={() => set({ questions: [...d.questions, newQuestion()] })}
          style={{ ...small, marginTop: 8 }}
        >
          + Add a question
        </button>
        {dropped.length > 0 && (
          <div style={{ fontSize: 11.5, color: "#fca5a5", marginTop: 6 }}>
            A &quot;Pick one&quot; question needs at least two choices, or it won&apos;t be asked.
          </div>
        )}

        <div style={{ ...S.sectionTitle, marginTop: 22 }}>Who gets in</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Switch
            on={d.age18}
            onClick={() => set({ age18: !d.age18 })}
            label="18 or older only"
            hint="Visitors confirm their age at the door."
          />
          <Switch
            on={d.lock}
            onClick={() => set({ lock: !d.lock })}
            label="No looking round first"
            hint="Visitors see only the door until they're in. Off: they can close it and look round."
          />
          <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>
              New accounts wait
              <span
                style={{
                  display: "block",
                  fontSize: 11,
                  opacity: 0.55,
                  fontWeight: 400,
                  marginTop: 2,
                }}
              >
                Accounts younger than this can&apos;t join. Keeps out fresh throwaways. 0 is off.
              </span>
            </span>
            <input
              type="number"
              min={0}
              max={365}
              value={d.minAccountDays}
              onChange={(e) =>
                set({ minAccountDays: Math.max(0, Math.min(365, Number(e.target.value) || 0)) })
              }
              style={{ ...S.input, width: 80, textAlign: "center" }}
              aria-label="Days"
            />
            <span style={{ fontSize: 12, opacity: 0.6 }}>days</span>
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4, lineHeight: 1.5 }}>
            After the door: {MODE_WORDS[mode] || MODE_WORDS.OPEN} Change who gets in under Branding.
          </div>
        </div>
      </div>

      <div
        style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18, flexWrap: "wrap" }}
      >
        <button
          style={{ ...S.btnPri, padding: "8px 20px", opacity: dirty ? 1 : 0.55 }}
          onClick={save}
          disabled={saving || !dirty}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button style={{ ...S.btn, padding: "8px 14px" }} onClick={() => setPreview(true)}>
          Preview the door
        </button>
        {dirty && !saving && (
          <button
            style={{ ...S.btn, padding: "8px 14px" }}
            onClick={() => {
              setD(saved);
              setOptText(
                Object.fromEntries(saved.questions.map((q) => [q.id, q.options.join(", ")])),
              );
            }}
          >
            Undo changes
          </button>
        )}
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>

      {preview && (
        <LobbyDoor
          lobbyId={lobby.id}
          lobbyName={lobby.name || lobby.id}
          door={{ ...built(), on: true }}
          accent={lobby.accentColor || "#7c3aed"}
          banner={lobby.bannerUrl}
          joinMode={mode}
          signedIn
          preview
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  );
}
