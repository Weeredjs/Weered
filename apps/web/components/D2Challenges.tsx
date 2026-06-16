"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import { ACCENT_DESTINY, S, apiFetch, currentUserId } from "./D2Shared";

export const DIFFICULTY_STARS = ["", "★", "★★", "★★★", "★★★★", "★★★★★"];
export const CATEGORY_COLORS: Record<string, string> = {
  crucible: "#ef4444",
  pve: "#22c55e",
  raid: "#a855f7",
  seasonal: "#f59e0b",
  dungeon: "#6366f1",
};

export function ChallengeCard({
  challenge,
  enrollment,
  onEnroll,
  onAbandon,
}: {
  challenge: any;
  enrollment: any;
  onEnroll: () => void;
  onAbandon: () => void;
}) {
  const def = challenge.definition;
  const objectives = (def.objectives || []) as any[];
  const progress = enrollment?.progress || {};
  const isEnrolled = enrollment && enrollment.status === "ACTIVE";
  const isCompleted = enrollment?.status === "COMPLETED";
  const catColor = CATEGORY_COLORS[def.category] || ACCENT_DESTINY;
  const timeLeft = challenge.endsAt
    ? Math.max(0, new Date(challenge.endsAt).getTime() - Date.now())
    : null;
  const daysLeft = timeLeft ? Math.ceil(timeLeft / 86400000) : null;

  return (
    <div
      style={{
        ...S.card,
        borderColor: isCompleted
          ? "rgba(34,197,94,.3)"
          : isEnrolled
            ? `${catColor}44`
            : "rgba(255,255,255,.08)",
        background: isCompleted
          ? "rgba(34,197,94,.05)"
          : isEnrolled
            ? `${catColor}08`
            : "rgba(255,255,255,.03)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span
              style={{
                fontSize: 8,
                fontWeight: 800,
                letterSpacing: "1px",
                textTransform: "uppercase",
                padding: "1px 6px",
                borderRadius: 2,
                background: `${catColor}20`,
                color: catColor,
              }}
            >
              {def.category || "general"}
            </span>
            <span style={{ fontSize: 10, color: "#fcd34d", letterSpacing: "1px" }}>
              {DIFFICULTY_STARS[def.difficulty] || "★"}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(243,244,246,.92)" }}>
            {def.title}
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{def.description}</div>
        </div>
        <div
          style={{
            textAlign: "center",
            padding: "6px 10px",
            borderRadius: 2,
            background: "rgba(124,58,237,.1)",
            border: "1px solid rgba(124,58,237,.2)",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900, color: "#a78bfa" }}>
            {def.notorietyReward}
          </div>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              opacity: 0.5,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            XP
          </div>
        </div>
      </div>

      {objectives.map((obj: any) => {
        const p = progress[obj.id] || { current: 0, target: obj.target, completed: false };
        const pct = Math.min(100, Math.round((p.current / p.target) * 100));
        return (
          <div key={obj.id}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                marginBottom: 3,
              }}
            >
              <span style={{ opacity: 0.7 }}>{obj.description}</span>
              {isEnrolled && (
                <span
                  style={{
                    fontWeight: 700,
                    fontFamily: "monospace",
                    color: p.completed ? "#22c55e" : "rgba(255,255,255,.6)",
                  }}
                >
                  {p.current}/{p.target}
                </span>
              )}
            </div>
            {isEnrolled && (
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: "rgba(255,255,255,.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    borderRadius: 2,
                    width: `${pct}%`,
                    background: p.completed ? "#22c55e" : catColor,
                    transition: "width .3s ease",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 2,
        }}
      >
        <div style={{ fontSize: 10, opacity: 0.35 }}>
          {daysLeft != null ? `${daysLeft}d remaining` : "No deadline"}
          {challenge._count?.enrollments > 0 && ` · ${challenge._count.enrollments} enrolled`}
        </div>
        {isCompleted ? (
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 2,
              fontSize: 11,
              fontWeight: 700,
              background: "rgba(34,197,94,.15)",
              color: "#86efac",
            }}
          >
            ✓ Completed
          </span>
        ) : isEnrolled ? (
          <button
            onClick={onAbandon}
            style={{
              ...S.btn,
              fontSize: 10,
              padding: "3px 10px",
              borderColor: "rgba(239,68,68,.25)",
              color: "rgba(252,165,165,.7)",
            }}
          >
            Abandon
          </button>
        ) : (
          <button onClick={onEnroll} style={{ ...S.btnPri, fontSize: 11, padding: "5px 14px" }}>
            Enroll
          </button>
        )}
      </div>
    </div>
  );
}

export function ChallengeLeaderboard({
  instanceId,
  challengeTitle,
}: {
  instanceId: string;
  challengeTitle: string;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/challenges/${instanceId}/leaderboard`).then((res) => {
      if (res?.leaderboard) setRows(res.leaderboard);
      setLoading(false);
    });
  }, [instanceId]);

  if (loading) return <LoadingState compact label="Loading" />;
  if (rows.length === 0) return <EmptyState compact title="No completions yet." />;

  const RANK_COLORS = ["#fcd34d", "#94a3b8", "#cd7f32"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginBottom: 4 }}>
        {challengeTitle}
      </div>
      {rows.map((r: any) => (
        <div
          key={r.rank}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 10px",
            borderRadius: 2,
            background: r.rank <= 3 ? `${RANK_COLORS[r.rank - 1]}08` : "transparent",
            borderLeft:
              r.rank <= 3 ? `3px solid ${RANK_COLORS[r.rank - 1]}` : "3px solid transparent",
          }}
        >
          <span
            style={{
              width: 22,
              textAlign: "center",
              fontWeight: 900,
              fontSize: 13,
              color: r.rank <= 3 ? RANK_COLORS[r.rank - 1] : "rgba(255,255,255,.3)",
              fontFamily: "monospace",
            }}
          >
            {r.rank}
          </span>
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "rgba(243,244,246,.85)" }}>
            {r.name}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 6px",
              borderRadius: 2,
              background: "rgba(124,58,237,.1)",
              color: "#a78bfa",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {r.tier}
          </span>
          <span style={{ fontSize: 10, opacity: 0.35, fontFamily: "monospace" }}>
            {r.completedAt ? new Date(r.completedAt).toLocaleDateString() : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

export const CB_ACCENT = "#f58220";
export const CB_ACTIVITIES: { v: string; label: string }[] = [
  { v: "ANY", label: "Any activity" },
  { v: "DUNGEON", label: "A Dungeon" },
  { v: "RAID", label: "A Raid" },
  { v: "NIGHTFALL", label: "A Nightfall" },
  { v: "STRIKE", label: "A Strike" },
  { v: "CRUCIBLE", label: "A Crucible match" },
  { v: "GAMBIT", label: "A Gambit match" },
];
export const CB_ACT_LABEL: Record<string, string> = Object.fromEntries(
  CB_ACTIVITIES.map((a) => [a.v, a.label]),
);

export type CBStep = { activity: string; count: number; mods: string[] };

export function ChallengeBuilder({
  lobbyId,
  myCreated,
  onClose,
  onChanged,
}: {
  lobbyId: string;
  myCreated: any[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState<CBStep[]>([{ activity: "ANY", count: 1, mods: [] }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/challenges/modifiers/catalog").then((j: any) => {
      if (j?.modifiers)
        setCatalog(
          j.modifiers.filter(
            (m: any) => m.slotKind === "PLAYER_PICK" && (m.tab === "BOON" || m.tab === "CHALLENGE"),
          ),
        );
    });
  }, []);

  const groups = [
    { tab: "BOON", label: "Boons — buffs you turn on" },
    { tab: "CHALLENGE", label: "Challenge modifiers — make it harder" },
  ];

  function setStep(i: number, patch: Partial<CBStep>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function toggleMod(i: number, slug: string) {
    setSteps((prev) =>
      prev.map((s, idx) => {
        if (idx !== i) return s;
        const has = s.mods.includes(slug);
        return { ...s, mods: has ? s.mods.filter((x) => x !== slug) : [...s.mods, slug] };
      }),
    );
  }
  function addStep() {
    if (steps.length < 5) setSteps((prev) => [...prev, { activity: "ANY", count: 1, mods: [] }]);
  }
  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  const modName = (slug: string) => catalog.find((m) => m.slug === slug)?.name || slug;
  const preview = steps
    .map((s) => {
      const a = (CB_ACT_LABEL[s.activity] || "Any activity").toLowerCase();
      const m = s.mods.length ? ` with ${s.mods.map(modName).join(" + ")}` : "";
      return `${s.count}× ${a}${m}`;
    })
    .join(", then ");

  const atCap = myCreated.length >= 3;

  async function create() {
    setBusy(true);
    setError("");
    try {
      const j = await apiFetch("/challenges/member-create", {
        method: "POST",
        body: JSON.stringify({
          lobbyId,
          title: title.trim() || undefined,
          steps: steps.map((s) => ({ activity: s.activity, count: s.count, modifiers: s.mods })),
        }),
      });
      if (j?.ok === false || !j?.definition) {
        setError(j?.message || j?.error || "Could not create challenge.");
        return;
      }
      onChanged();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function del(defId: string) {
    await apiFetch(`/challenges/definitions/${defId}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(6,5,3,.82)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          maxWidth: "100%",
          maxHeight: "88vh",
          overflowY: "auto",
          background: "#15110b",
          border: `1px solid ${CB_ACCENT}55`,
          borderRadius: 6,
          padding: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: 0.5,
              color: CB_ACCENT,
              textTransform: "uppercase",
            }}
          >
            Build a Challenge
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", ...S.btn }}>
            {"✕"}
          </button>
        </div>

        <div
          style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginBottom: 14, lineHeight: 1.5 }}
        >
          Pick an activity and the modifiers to enable in Custom Ops. Complete it in-game and it
          credits automatically. Up to 3 live challenges per member.
        </div>

        {myCreated.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={S.label}>Your challenges ({myCreated.length}/3)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {myCreated.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    background: "rgba(255,255,255,.03)",
                    border: "1px solid rgba(255,255,255,.08)",
                    borderRadius: 3,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,.85)",
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.definition?.title}
                  </span>
                  <button
                    onClick={() => del(c.definition.id)}
                    style={{ ...S.btn, fontSize: 11, padding: "3px 8px" }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <div style={S.label}>Name (optional)</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 80))}
            placeholder="Auto-named from your picks"
            style={S.input}
          />
        </div>

        {steps.map((s, i) => (
          <div
            key={i}
            style={{
              marginBottom: 10,
              padding: 12,
              background: "rgba(255,255,255,.025)",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1,
                  color: CB_ACCENT,
                  textTransform: "uppercase",
                }}
              >
                Step {i + 1}
              </div>
              {steps.length > 1 && (
                <button
                  onClick={() => removeStep(i)}
                  style={{ marginLeft: "auto", ...S.btn, fontSize: 11, padding: "2px 8px" }}
                >
                  Remove
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={S.label}>Activity</div>
                <select
                  value={s.activity}
                  onChange={(e) => setStep(i, { activity: e.target.value })}
                  style={{ ...S.input, cursor: "pointer" }}
                >
                  {CB_ACTIVITIES.map((a) => (
                    <option key={a.v} value={a.v}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ width: 90 }}>
                <div style={S.label}>How many</div>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={s.count}
                  onChange={(e) =>
                    setStep(i, { count: Math.max(1, Math.min(10, parseInt(e.target.value) || 1)) })
                  }
                  style={S.input}
                />
              </div>
            </div>
            <div style={S.label}>Modifiers to turn on</div>
            {groups.map((g) => {
              const items = catalog.filter((m) => m.tab === g.tab);
              if (!items.length) return null;
              return (
                <div key={g.tab} style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "rgba(255,255,255,.4)",
                      marginBottom: 4,
                    }}
                  >
                    {g.label}
                  </div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {items.map((m) => {
                      const on = s.mods.includes(m.slug);
                      return (
                        <button
                          key={m.slug}
                          onClick={() => toggleMod(i, m.slug)}
                          title={m.description}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 9px",
                            background: on ? `${CB_ACCENT}28` : "rgba(255,255,255,.04)",
                            border: `1px solid ${on ? CB_ACCENT : "rgba(255,255,255,.12)"}`,
                            color: on ? "#fff" : "rgba(255,255,255,.7)",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <span>{m.icon || (on ? "☑" : "☐")}</span>
                          {m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {steps.length < 5 && (
          <button onClick={addStep} style={{ ...S.btn, width: "100%", marginBottom: 12 }}>
            + Add another step
          </button>
        )}

        <div
          style={{
            padding: "10px 12px",
            background: "rgba(74,222,128,.07)",
            border: "1px solid rgba(74,222,128,.25)",
            borderRadius: 4,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "rgba(134,239,172,.8)",
              textTransform: "uppercase",
              letterSpacing: 0.6,
              marginBottom: 3,
            }}
          >
            Preview
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.85)" }}>
            {"✓"} Complete {preview || "…"}
          </div>
        </div>

        {error && <div style={{ fontSize: 12, color: "#fca5a5", marginBottom: 10 }}>{error}</div>}

        <button
          onClick={create}
          disabled={busy || atCap}
          style={{
            width: "100%",
            padding: "11px",
            borderRadius: 3,
            border: `1px solid ${CB_ACCENT}`,
            background: atCap
              ? "rgba(255,255,255,.06)"
              : `linear-gradient(135deg, ${CB_ACCENT}, #ff9a40)`,
            color: atCap ? "rgba(255,255,255,.4)" : "#1a0e04",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 1,
            textTransform: "uppercase",
            cursor: atCap || busy ? "not-allowed" : "pointer",
          }}
        >
          {atCap
            ? "You have 3 live challenges — delete one"
            : busy
              ? "Creating…"
              : "Create Challenge"}
        </button>
      </div>
    </div>
  );
}

export function ChallengeBoard({ lobbyId }: { lobbyId: string }) {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [myEnrollments, setMyEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"active" | "mine" | "completed" | "leaderboard">("active");
  const [leaderboardId, setLeaderboardId] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const enrollmentsRef = useRef(myEnrollments);
  enrollmentsRef.current = myEnrollments;

  const fetchAll = useCallback(async () => {
    const [cRes, mRes] = await Promise.all([
      apiFetch(`/challenges?lobbyId=${encodeURIComponent(lobbyId)}`),
      apiFetch("/challenges/my"),
    ]);
    if (cRes?.challenges) setChallenges(cRes.challenges);
    if (mRes?.enrollments) setMyEnrollments(mRes.enrollments);
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    function onChallengeEvent(e: Event) {
      const d = (e as CustomEvent).detail;
      if (!d?.instanceId) return;

      if (d.type === "challenge:progress") {
        setMyEnrollments((prev) =>
          prev.map((en) => (en.instanceId === d.instanceId ? { ...en, progress: d.progress } : en)),
        );
      }

      if (d.type === "challenge:completed") {
        setMyEnrollments((prev) =>
          prev.map((en) =>
            en.instanceId === d.instanceId
              ? {
                  ...en,
                  progress: d.progress,
                  status: "COMPLETED",
                  completedAt: new Date().toISOString(),
                }
              : en,
          ),
        );
      }
    }

    window.addEventListener("weered:challenge", onChallengeEvent);
    return () => window.removeEventListener("weered:challenge", onChallengeEvent);
  }, []);

  const enroll = async (instanceId: string) => {
    await apiFetch(`/challenges/${instanceId}/enroll`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    fetchAll();
  };
  const abandon = async (instanceId: string) => {
    await apiFetch(`/challenges/${instanceId}/enroll`, {
      method: "DELETE",
      body: JSON.stringify({}),
    });
    fetchAll();
  };

  const enrollMap = new Map<string, any>();
  for (const e of myEnrollments) enrollMap.set(e.instanceId, e);

  const activeChallenges = challenges.filter((c) => c.status === "ACTIVE");
  const myChallenges = myEnrollments.filter((e) => e.status === "ACTIVE");
  const completedChallenges = myEnrollments.filter((e) => e.status === "COMPLETED");
  const uid = currentUserId();
  const myCreated = challenges.filter(
    (c) => c?.definition?.createdById && c.definition.createdById === uid,
  );

  const lbChallenge = leaderboardId ? challenges.find((c) => c.id === leaderboardId) : null;

  if (loading)
    return <div style={{ padding: 20, opacity: 0.4, fontSize: 12 }}>Loading challenges...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {showBuilder && (
        <ChallengeBuilder
          lobbyId={lobbyId}
          myCreated={myCreated}
          onClose={() => setShowBuilder(false)}
          onChanged={fetchAll}
        />
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(["active", "mine", "completed", "leaderboard"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            style={{
              padding: "5px 12px",
              borderRadius: 2,
              border:
                subTab === t ? "1px solid rgba(79,136,198,.4)" : "1px solid rgba(255,255,255,.08)",
              background: subTab === t ? "rgba(79,136,198,.12)" : "rgba(255,255,255,.03)",
              color: subTab === t ? "rgba(243,244,246,.9)" : "rgba(148,163,184,.6)",
              fontSize: 11,
              fontWeight: subTab === t ? 700 : 400,
              cursor: "pointer",
            }}
          >
            {t === "active"
              ? `Challenges (${activeChallenges.length})`
              : t === "mine"
                ? `My Active (${myChallenges.length})`
                : t === "completed"
                  ? `Completed (${completedChallenges.length})`
                  : "🏆 Leaderboard"}
          </button>
        ))}
        <button
          onClick={() => setShowBuilder(true)}
          style={{
            marginLeft: "auto",
            padding: "5px 12px",
            borderRadius: 2,
            border: "1px solid rgba(245,130,32,.5)",
            background: "rgba(245,130,32,.14)",
            color: "#f7a64a",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Build a Challenge
        </button>
      </div>

      {subTab === "active" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activeChallenges.length === 0 ? (
            <EmptyState compact title="No active challenges." hint="Drops on reset." />
          ) : (
            activeChallenges.map((c) => (
              <ChallengeCard
                key={c.id}
                challenge={c}
                enrollment={enrollMap.get(c.id)}
                onEnroll={() => enroll(c.id)}
                onAbandon={() => abandon(c.id)}
              />
            ))
          )}
        </div>
      )}

      {subTab === "mine" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {myChallenges.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", opacity: 0.3, fontSize: 12 }}>
              You haven&apos;t enrolled in any challenges yet.
            </div>
          ) : (
            myChallenges.map((e) => {
              const c = challenges.find((ch) => ch.id === e.instanceId) || {
                definition: e.instance?.definition,
                _count: { enrollments: 0 },
                ...e.instance,
              };
              return (
                <ChallengeCard
                  key={e.id}
                  challenge={c}
                  enrollment={e}
                  onEnroll={() => {}}
                  onAbandon={() => abandon(e.instanceId)}
                />
              );
            })
          )}
        </div>
      )}

      {subTab === "completed" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {completedChallenges.length === 0 ? (
            <EmptyState compact title="Nothing completed yet." hint="Get grinding." />
          ) : (
            completedChallenges.map((e) => {
              const c = challenges.find((ch) => ch.id === e.instanceId) || {
                definition: e.instance?.definition,
                _count: { enrollments: 0 },
                ...e.instance,
              };
              return (
                <ChallengeCard
                  key={e.id}
                  challenge={c}
                  enrollment={e}
                  onEnroll={() => {}}
                  onAbandon={() => {}}
                />
              );
            })
          )}
        </div>
      )}

      {subTab === "leaderboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!leaderboardId ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>
                Select a challenge to view its leaderboard:
              </div>
              {activeChallenges.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setLeaderboardId(c.id)}
                  style={{
                    ...S.card,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(243,244,246,.9)" }}>
                      {c.definition.title}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.4 }}>
                      {c._count?.enrollments || 0} enrolled
                    </div>
                  </div>
                  <span style={{ fontSize: 16, opacity: 0.3 }}>→</span>
                </button>
              ))}
              {activeChallenges.length === 0 && (
                <div style={{ padding: 20, textAlign: "center", opacity: 0.3, fontSize: 12 }}>
                  No challenges available.
                </div>
              )}
            </div>
          ) : (
            <div>
              <button
                onClick={() => setLeaderboardId(null)}
                style={{
                  ...S.btn,
                  fontSize: 10,
                  marginBottom: 8,
                  padding: "3px 10px",
                }}
              >
                ← Back
              </button>
              <ChallengeLeaderboard
                instanceId={leaderboardId}
                challengeTitle={lbChallenge?.definition?.title || "Challenge"}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
