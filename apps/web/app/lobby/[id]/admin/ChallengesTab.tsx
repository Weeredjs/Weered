"use client";
import { useState, useEffect, useCallback } from "react";
import { S, apiFetch } from "./shared";

export const EVENT_STATUS_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  DRAFT: {
    bg: "rgba(255,255,255,.05)",
    border: "rgba(255,255,255,.15)",
    color: "rgba(255,255,255,.6)",
  },
  PUBLISHED: {
    bg: "rgba(16,185,129,.10)",
    border: "rgba(16,185,129,.30)",
    color: "rgb(167,243,208)",
  },
  CANCELED: { bg: "rgba(239,68,68,.10)", border: "rgba(239,68,68,.30)", color: "rgb(252,165,165)" },
  COMPLETED: {
    bg: "rgba(14,165,233,.10)",
    border: "rgba(14,165,233,.28)",
    color: "rgb(186,230,253)",
  },
};

export function EventStatusBadge({ status }: { status: string }) {
  const c = EVENT_STATUS_COLORS[status] || EVENT_STATUS_COLORS.DRAFT;
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 7px",
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        fontWeight: 700,
        letterSpacing: ".4px",
      }}
    >
      {status}
    </span>
  );
}

export const OBJECTIVE_TYPES = [
  { value: "kills", label: "Kills" },
  { value: "weapon_kills", label: "Weapon Kills" },
  { value: "activities", label: "Activity Completions" },
  { value: "wins", label: "Wins" },
  { value: "speed_clear", label: "Speed Clear" },
  { value: "win_streak", label: "Win Streak" },
  { value: "kd_threshold", label: "K/D Threshold" },
  { value: "stat_total", label: "Stat Total (K+A)" },
];

export const CATEGORY_OPTIONS = ["crucible", "pve", "raid", "dungeon", "seasonal"];

export const SCOPE_OPTIONS = [
  { value: "LOBBY", label: "This Lobby" },
  { value: "GLOBAL", label: "Global" },
];

export const SCHEDULE_OPTIONS = [
  { value: "", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly (Tuesday)" },
  { value: "weekly_friday", label: "Weekly (Friday)" },
];

export function ChallengesTab({ lobbyId }: { lobbyId: string }) {
  const [defs, setDefs] = useState<any[]>([]);
  const [instances, setInstances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "pve",
    difficulty: 2,
    scope: "LOBBY",
    notorietyReward: 200,
    isRecurring: false,
    recurSchedule: "",
  });
  const [objectives, setObjectives] = useState([
    {
      id: "obj_1",
      type: "activities",
      description: "",
      target: 5,
      modes: "",
      activityHashes: "",
      weaponHashes: "",
      weaponSubTypes: "",
      requireCompletion: true,
      requireWin: false,
      maxDuration: 0,
      minKd: 0,
    },
  ]);

  const load = useCallback(async () => {
    const [dRes, iRes] = await Promise.all([
      apiFetch("/challenges/definitions"),
      apiFetch(`/challenges?lobbyId=${encodeURIComponent(lobbyId)}`),
    ]);
    if (dRes?.definitions) setDefs(dRes.definitions);
    if (iRes?.challenges) setInstances(iRes.challenges);
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => {
    load();
  }, [load]);

  function addObjective() {
    const idx = objectives.length + 1;
    setObjectives((prev) => [
      ...prev,
      {
        id: `obj_${idx}`,
        type: "activities",
        description: "",
        target: 5,
        modes: "",
        activityHashes: "",
        weaponHashes: "",
        weaponSubTypes: "",
        requireCompletion: true,
        requireWin: false,
        maxDuration: 0,
        minKd: 0,
      },
    ]);
  }

  function updateObjective(idx: number, key: string, val: any) {
    setObjectives((prev) => prev.map((o, i) => (i === idx ? { ...o, [key]: val } : o)));
  }

  function removeObjective(idx: number) {
    if (objectives.length <= 1) return;
    setObjectives((prev) => prev.filter((_, i) => i !== idx));
  }

  async function createChallenge() {
    if (!form.title.trim()) {
      setMsg("Title required.");
      return;
    }
    if (objectives.some((o) => !o.description.trim())) {
      setMsg("All objectives need a description.");
      return;
    }

    setCreating(true);

    const objs = objectives.map((o) => ({
      id: o.id,
      type: o.type,
      description: o.description,
      target: Number(o.target) || 1,
      filters: {
        ...(o.modes
          ? {
              modes: o.modes
                .split(",")
                .map((s) => Number(s.trim()))
                .filter((n) => n > 0),
            }
          : {}),
        ...(o.activityHashes
          ? {
              activityHashes: o.activityHashes
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
        ...(o.weaponHashes
          ? {
              weaponHashes: o.weaponHashes
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : {}),
        ...(o.weaponSubTypes
          ? {
              weaponSubTypes: o.weaponSubTypes
                .split(",")
                .map((s) => Number(s.trim()))
                .filter((n) => n > 0),
            }
          : {}),
        ...(o.requireCompletion ? { requireCompletion: true } : {}),
        ...(o.requireWin ? { requireWin: true } : {}),
        ...(o.maxDuration > 0 ? { maxDuration: o.maxDuration } : {}),
        ...(o.minKd > 0 ? { minKd: o.minKd } : {}),
      },
    }));

    const j = await apiFetch("/challenges/definitions", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        lobbyId,
        objectives: objs,
        requireAll: true,
        notorietyReward: Number(form.notorietyReward) || 0,
      }),
    });
    setCreating(false);

    if (j.ok) {
      setMsg(`Created "${j.definition.title}". Now activate it to make it live.`);
      setForm({
        title: "",
        description: "",
        category: "pve",
        difficulty: 2,
        scope: "LOBBY",
        notorietyReward: 200,
        isRecurring: false,
        recurSchedule: "",
      });
      setObjectives([
        {
          id: "obj_1",
          type: "activities",
          description: "",
          target: 5,
          modes: "",
          activityHashes: "",
          weaponHashes: "",
          weaponSubTypes: "",
          requireCompletion: true,
          requireWin: false,
          maxDuration: 0,
          minKd: 0,
        },
      ]);
      load();
    } else setMsg(j.error || "Failed to create.");
  }

  async function activateDef(defId: string) {
    const j = await apiFetch(`/challenges/definitions/${defId}/activate`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (j.ok) {
      setMsg("Challenge activated!");
      load();
    } else setMsg(j.error || "Failed.");
  }

  if (loading) return <div style={{ opacity: 0.4, fontSize: 13 }}>Loading challenges...</div>;

  const DIFF_STARS = ["", "★", "★★", "★★★", "★★★★", "★★★★★"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {msg && (
        <div
          style={{
            fontSize: 12,
            color: "rgba(167,243,208,.9)",
            padding: "8px 12px",
            borderRadius: 8,
            background: "rgba(16,185,129,.08)",
            border: "1px solid rgba(16,185,129,.25)",
          }}
        >
          {msg}
        </div>
      )}

      <div>
        <div style={S.sectionTitle}>Create Challenge</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={S.label}>Title</div>
            <input
              style={S.input}
              placeholder="Crucible Slayer"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <div style={S.label}>Category</div>
            <select
              style={{ ...S.input, appearance: "auto" }}
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={S.label}>Description</div>
            <input
              style={S.input}
              placeholder="Get 50 kills in any Crucible playlist."
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <div style={S.label}>Difficulty (1-5)</div>
            <select
              style={{ ...S.input, appearance: "auto" }}
              value={form.difficulty}
              onChange={(e) => setForm((f) => ({ ...f, difficulty: Number(e.target.value) }))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {DIFF_STARS[n]} ({n})
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={S.label}>XP Reward</div>
            <input
              style={S.input}
              type="number"
              value={form.notorietyReward}
              onChange={(e) => setForm((f) => ({ ...f, notorietyReward: Number(e.target.value) }))}
            />
          </div>
          <div>
            <div style={S.label}>Scope</div>
            <select
              style={{ ...S.input, appearance: "auto" }}
              value={form.scope}
              onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
            >
              {SCOPE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={S.label}>Schedule</div>
            <select
              style={{ ...S.input, appearance: "auto" }}
              value={form.recurSchedule}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  recurSchedule: e.target.value,
                  isRecurring: !!e.target.value,
                }))
              }
            >
              {SCHEDULE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div
            style={{
              ...S.label,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Objectives</span>
            <button onClick={addObjective} style={{ ...S.btn, fontSize: 10, padding: "2px 8px" }}>
              + Add
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {objectives.map((obj, idx) => (
              <div
                key={idx}
                style={{ ...S.card, display: "flex", flexDirection: "column", gap: 8 }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.4 }}>
                    Objective {idx + 1}
                  </span>
                  {objectives.length > 1 && (
                    <button
                      onClick={() => removeObjective(idx)}
                      style={{
                        ...S.btn,
                        fontSize: 9,
                        padding: "1px 6px",
                        color: "rgba(252,165,165,.7)",
                        borderColor: "rgba(239,68,68,.2)",
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>Type</div>
                    <select
                      style={{ ...S.input, fontSize: 11, appearance: "auto" }}
                      value={obj.type}
                      onChange={(e) => updateObjective(idx, "type", e.target.value)}
                    >
                      {OBJECTIVE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>Target</div>
                    <input
                      style={{ ...S.input, fontSize: 11 }}
                      type="number"
                      value={obj.target}
                      onChange={(e) => updateObjective(idx, "target", Number(e.target.value))}
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>Description</div>
                    <input
                      style={{ ...S.input, fontSize: 11 }}
                      placeholder="Get 50 Crucible kills"
                      value={obj.description}
                      onChange={(e) => updateObjective(idx, "description", e.target.value)}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>
                      Mode IDs (comma-sep)
                    </div>
                    <input
                      style={{ ...S.input, fontSize: 11 }}
                      placeholder="5,10,12,84"
                      value={obj.modes}
                      onChange={(e) => updateObjective(idx, "modes", e.target.value)}
                    />
                  </div>
                  {obj.type === "speed_clear" && (
                    <div>
                      <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>
                        Max Duration (sec)
                      </div>
                      <input
                        style={{ ...S.input, fontSize: 11 }}
                        type="number"
                        value={obj.maxDuration}
                        onChange={(e) =>
                          updateObjective(idx, "maxDuration", Number(e.target.value))
                        }
                      />
                    </div>
                  )}
                  {obj.type === "kd_threshold" && (
                    <div>
                      <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>Min K/D</div>
                      <input
                        style={{ ...S.input, fontSize: 11 }}
                        type="number"
                        step="0.1"
                        value={obj.minKd}
                        onChange={(e) => updateObjective(idx, "minKd", Number(e.target.value))}
                      />
                    </div>
                  )}
                  {obj.type === "weapon_kills" && (
                    <div>
                      <div style={{ fontSize: 9, opacity: 0.4, marginBottom: 2 }}>
                        Weapon Hashes (comma-sep)
                      </div>
                      <input
                        style={{ ...S.input, fontSize: 11 }}
                        placeholder="Optional"
                        value={obj.weaponHashes}
                        onChange={(e) => updateObjective(idx, "weaponHashes", e.target.value)}
                      />
                    </div>
                  )}
                  <div
                    style={{ display: "flex", gap: 12, alignItems: "center", gridColumn: "1 / -1" }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 10,
                        opacity: 0.6,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={obj.requireCompletion}
                        onChange={(e) =>
                          updateObjective(idx, "requireCompletion", e.target.checked)
                        }
                      />
                      Require Completion
                    </label>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 10,
                        opacity: 0.6,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={obj.requireWin}
                        onChange={(e) => updateObjective(idx, "requireWin", e.target.checked)}
                      />
                      Require Win
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          style={{ ...S.btnPri, marginTop: 14, width: "100%", padding: "10px 0", fontWeight: 800 }}
          onClick={createChallenge}
          disabled={creating}
        >
          {creating ? "Creating..." : "Create Challenge Definition"}
        </button>
      </div>

      <div>
        <div style={S.sectionTitle}>Challenge Definitions ({defs.length})</div>
        {defs.length === 0 && (
          <div style={{ opacity: 0.4, fontSize: 13, padding: "16px 0", textAlign: "center" }}>
            No challenge definitions yet.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {defs.map((d) => {
            const hasActiveInstance = instances.some(
              (i) => i.definitionId === d.id && i.status === "ACTIVE",
            );
            return (
              <div key={d.id} style={S.card}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{d.title}</span>
                      <span style={{ fontSize: 10, opacity: 0.3 }}>{DIFF_STARS[d.difficulty]}</span>
                      <span
                        style={{
                          fontSize: 9,
                          padding: "1px 5px",
                          borderRadius: 4,
                          background:
                            d.status === "ACTIVE" ? "rgba(34,197,94,.1)" : "rgba(255,255,255,.05)",
                          border: `1px solid ${d.status === "ACTIVE" ? "rgba(34,197,94,.25)" : "rgba(255,255,255,.08)"}`,
                          color: d.status === "ACTIVE" ? "#86efac" : "rgba(255,255,255,.4)",
                          fontWeight: 700,
                        }}
                      >
                        {d.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{d.description}</div>
                    <div style={{ fontSize: 10, opacity: 0.3, marginTop: 3 }}>
                      {d.category} | {d.notorietyReward} XP | {(d.objectives as any[])?.length || 0}{" "}
                      objective(s)
                      {d.isRecurring && ` | ${d.recurSchedule}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {d.status === "DRAFT" && !hasActiveInstance && (
                      <button style={S.btnPri} onClick={() => activateDef(d.id)}>
                        Activate
                      </button>
                    )}
                    {hasActiveInstance && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: "rgba(34,197,94,.08)",
                          color: "#86efac",
                          fontWeight: 700,
                        }}
                      >
                        Live
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={S.sectionTitle}>Active Challenge Instances ({instances.length})</div>
        {instances.length === 0 && (
          <div style={{ opacity: 0.4, fontSize: 13, padding: "16px 0", textAlign: "center" }}>
            No active challenges.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {instances.map((i) => (
            <div key={i.id} style={{ ...S.card, padding: "8px 12px" }}>
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
              >
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{i.definition?.title}</span>
                  <span style={{ fontSize: 10, opacity: 0.4, marginLeft: 8 }}>
                    {i._count?.enrollments || 0} enrolled
                  </span>
                </div>
                <div style={{ fontSize: 10, opacity: 0.35 }}>
                  {new Date(i.startsAt).toLocaleDateString()} —{" "}
                  {i.endsAt ? new Date(i.endsAt).toLocaleDateString() : "No end"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export type FlairItem = {
  id: string;
  name: string;
  category: string;
  rarity: string;
  imageUrl?: string | null;
};
export type TournamentRow = {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  rewards: any;
  _count?: { entries: number };
};
