"use client";
import React, { useState, useEffect } from "react";
import { avatarBg } from "../../lib/avatarColor";
import CrewChatPanel from "../CrewChatPanel";
import EmptyState from "../EmptyState";
import { weeredConfirm } from "../../lib/confirm";

// Crew tab extracted from DockShell.

export function CrewTab({
  apiBase,
  tokenMaybe,
  myId,
  myName,
  onJoin,
}: {
  apiBase: string;
  tokenMaybe: string;
  myId: string;
  myName: string;
  onJoin: (r: string) => void;
}) {
  const [crews, setCrews] = React.useState<any[]>([]);
  const [view, setView] = React.useState<"list" | "create">("list");
  const [newName, setNewName] = React.useState("");
  const [newTag, setNewTag] = React.useState("");
  const [newDesc, setNewDesc] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [expandedCrew, setExpandedCrew] = React.useState<string | null>(null);
  const [presenceToast, setPresenceToast] = React.useState<{
    name: string;
    online: boolean;
  } | null>(null);

  React.useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d?.name || d.userId === myId) return;
      setPresenceToast({ name: d.name, online: Boolean(d.online) });
      setTimeout(() => setPresenceToast(null), 3000);
    };
    window.addEventListener("weered:crew:presence", handler);
    return () => window.removeEventListener("weered:crew:presence", handler);
  }, [myId]);

  async function load() {
    if (!apiBase || !tokenMaybe) return;
    try {
      const j = await fetch(`${apiBase}/crews/mine`, {
        headers: { Authorization: `Bearer ${tokenMaybe}` },
      }).then((r) => r.json());
      setCrews(Array.isArray(j?.crews) ? j.crews : []);
    } catch {}
  }

  React.useEffect(() => {
    void load();
  }, [apiBase, tokenMaybe]);
  React.useEffect(() => {
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [apiBase, tokenMaybe]);

  async function createCrew() {
    if (!newName.trim()) return;
    setCreating(true);
    setNote("");
    try {
      const j = await fetch(`${apiBase}/crews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenMaybe}` },
        body: JSON.stringify({
          name: newName.trim(),
          tag: newTag.trim(),
          description: newDesc.trim(),
        }),
      }).then((r) => r.json());
      if (j.ok) {
        setView("list");
        setNewName("");
        setNewTag("");
        setNewDesc("");
        void load();
      } else setNote(j.error || "Failed");
    } catch {
      setNote("Error");
    }
    setCreating(false);
  }

  const [inviteInput, setInviteInput] = React.useState<Record<string, string>>({});
  const [inviteNote, setInviteNote] = React.useState<Record<string, string>>({});

  async function inviteMember(crewId: string) {
    const username = (inviteInput[crewId] || "").trim();
    if (!username) return;
    try {
      const profile = await fetch(`${apiBase}/profile/${encodeURIComponent(username)}`, {
        headers: { Authorization: `Bearer ${tokenMaybe}` },
      }).then((r) => r.json());
      if (!profile?.id) {
        setInviteNote((n) => ({ ...n, [crewId]: "User not found" }));
        return;
      }
      const res = await fetch(`${apiBase}/crews/${crewId}/invite/${profile.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenMaybe}` },
      }).then((r) => r.json());
      if (res.ok) {
        setInviteInput((v) => ({ ...v, [crewId]: "" }));
        setInviteNote((n) => ({ ...n, [crewId]: "Invited!" }));
        void load();
      } else setInviteNote((n) => ({ ...n, [crewId]: res.error || "Failed" }));
    } catch {
      setInviteNote((n) => ({ ...n, [crewId]: "Error" }));
    }
    setTimeout(() => setInviteNote((n) => ({ ...n, [crewId]: "" })), 3000);
  }

  async function leaveCrew(crewId: string) {
    const ok = await weeredConfirm({
      title: "Leave this crew?",
      body: "You'll stop seeing crew chat and presence. You can be re-invited later.",
      confirmLabel: "Leave",
      destructive: true,
    });
    if (!ok) return;
    await fetch(`${apiBase}/crews/${crewId}/members/${myId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenMaybe}` },
    });
    void load();
  }
  async function disbandCrew(crewId: string) {
    const ok = await weeredConfirm({
      title: "Disband this crew?",
      body: "Everyone gets removed and the crew is gone. This can't be undone.",
      confirmLabel: "Disband",
      destructive: true,
    });
    if (!ok) return;
    await fetch(`${apiBase}/crews/${crewId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenMaybe}` },
    });
    void load();
  }

  const iStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--weered-bd2)",
    background: "rgba(255,255,255,.05)",
    color: "var(--weered-text)",
    outline: "none",
    fontSize: 13,
    boxSizing: "border-box" as const,
  };

  const roleBadge = (role: string) => {
    if (role === "LEADER")
      return {
        label: "★ LEADER",
        bg: "rgba(212,160,23,.15)",
        border: "rgba(212,160,23,.35)",
        color: "#D4A017",
      };
    if (role === "OFFICER")
      return {
        label: "◆ OFFICER",
        bg: "rgba(88,0,229,.12)",
        border: "rgba(88,0,229,.3)",
        color: "#a78bfa",
      };
    return null;
  };

  if (view === "create")
    return (
      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <button
            onClick={() => setView("list")}
            style={{
              background: "none",
              border: "none",
              color: "var(--weered-muted)",
              cursor: "pointer",
              fontSize: 18,
              padding: "0 4px",
            }}
          >
            ←
          </button>
          <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-0.2px" }}>
            Establish Crew
          </span>
        </div>
        {(
          [
            ["Name", "name", newName, setNewName, 40, "The 8 Meter"],
            ["Tag", "tag", newTag, setNewTag, 6, "W8M"],
            ["Description", "desc", newDesc, setNewDesc, 200, "What's your crew about"],
          ] as any[]
        ).map(([label, key, val, set, max, ph]) => (
          <div key={key}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "var(--weered-muted)",
                marginBottom: 4,
                textTransform: "uppercase" as const,
                letterSpacing: "0.06em",
              }}
            >
              {label}
            </div>
            <input
              value={val}
              onChange={(e: any) => set(e.target.value.slice(0, max))}
              placeholder={ph}
              style={iStyle}
            />
          </div>
        ))}
        {note && <div style={{ fontSize: 11, color: "rgba(252,165,165,.8)" }}>{note}</div>}
        <button
          onClick={createCrew}
          disabled={creating || !newName.trim()}
          style={{
            padding: "10px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            border: "1px solid rgba(212,160,23,.4)",
            background: "linear-gradient(135deg, rgba(88,0,229,.12), rgba(212,160,23,.12))",
            color: "#D4A017",
          }}
        >
          {creating ? "Establishing…" : "⚔ Establish Crew"}
        </button>
      </div>
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div
        style={{ padding: "10px 12px", borderBottom: "1px solid var(--weered-bd)", flexShrink: 0 }}
      >
        <button
          onClick={() => setView("create")}
          style={{
            width: "100%",
            padding: "9px",
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            border: "1px solid rgba(212,160,23,.3)",
            background: "linear-gradient(135deg, rgba(88,0,229,.08), rgba(212,160,23,.08))",
            color: "#D4A017",
          }}
        >
          ⚔ Establish Crew
        </button>
      </div>
      {presenceToast && (
        <div
          style={{
            padding: "6px 12px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: presenceToast.online ? "rgba(34,197,94,.08)" : "rgba(255,255,255,.03)",
            borderBottom: "1px solid rgba(255,255,255,.04)",
            animation: "weeredFadeIn 0.2s ease-out",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: presenceToast.online ? "#22c55e" : "rgba(255,255,255,.2)",
              boxShadow: presenceToast.online ? "0 0 6px rgba(34,197,94,.5)" : "none",
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: presenceToast.online ? "rgba(74,222,128,.8)" : "rgba(255,255,255,.35)",
            }}
          >
            <strong style={{ fontWeight: 700 }}>{presenceToast.name}</strong>{" "}
            {presenceToast.online ? "came online" : "went offline"}
          </span>
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {!crews.length && (
          <EmptyState
            icon="⚔"
            title="No crew yet."
            hint="Start one, or get invited. Reputation compounds."
          />
        )}
        {crews.map((crew) => {
          const isLeader = crew.myRole === "LEADER";
          const isOfficer = crew.myRole === "OFFICER";
          const canManage = isLeader || isOfficer;
          const members = crew.members || [];
          const onlineMembers = members.filter((m: any) => m.online);
          const isExpanded = expandedCrew === crew.id;

          return (
            <div key={crew.id} style={{ borderBottom: "1px solid var(--weered-bd)" }}>
              <div
                onClick={() => setExpandedCrew(isExpanded ? null : crew.id)}
                style={{
                  padding: "12px 14px",
                  cursor: "pointer",
                  background: isExpanded ? "rgba(88,0,229,.04)" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      flexShrink: 0,
                      background:
                        "linear-gradient(135deg, rgba(88,0,229,.2), rgba(212,160,23,.15))",
                      border: "1px solid rgba(212,160,23,.25)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      fontWeight: 900,
                      color: "#D4A017",
                      fontFamily: "monospace",
                    }}
                  >
                    {crew.tag ? crew.tag.slice(0, 2) : crew.name.slice(0, 1).toUpperCase()}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: 13,
                          color: "rgba(243,244,246,.95)",
                          letterSpacing: "-0.2px",
                        }}
                      >
                        {crew.name}
                      </span>
                      {crew.tag && (
                        <span
                          style={{
                            fontSize: 9,
                            padding: "2px 5px",
                            borderRadius: 5,
                            fontFamily: "monospace",
                            fontWeight: 700,
                            background: "rgba(212,160,23,.1)",
                            border: "1px solid rgba(212,160,23,.25)",
                            color: "rgba(212,160,23,.7)",
                          }}
                        >
                          [{crew.tag}]
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10 }}>
                      <span style={{ color: "var(--weered-muted)" }}>{members.length} members</span>
                      {onlineMembers.length > 0 && (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                            color: "rgba(74,222,128,.7)",
                          }}
                        >
                          <span
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: 999,
                              background: "#22c55e",
                              boxShadow: "0 0 4px rgba(34,197,94,.5)",
                            }}
                          />
                          {onlineMembers.length} online
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--weered-muted)",
                      transition: "transform 0.2s",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    ▾
                  </span>
                </div>

                {!isExpanded && members.length > 0 && (
                  <div style={{ display: "flex", marginTop: 8, marginLeft: 48 }}>
                    {members.slice(0, 6).map((m: any, i: number) => {
                      const bg = m.avatarColor || avatarBg(m.name || "?");
                      return (
                        <div
                          key={m.userId}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 999,
                            border: "2px solid rgba(15,17,23,.9)",
                            marginLeft: i > 0 ? -6 : 0,
                            zIndex: 6 - i,
                            background: m.avatar
                              ? `url(${m.avatar}) center/cover`
                              : bg || "rgba(255,255,255,.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#fff",
                            position: "relative" as const,
                          }}
                        >
                          {!m.avatar && (m.name || "?")[0]?.toUpperCase()}
                          {m.online && (
                            <span
                              style={{
                                position: "absolute",
                                bottom: -1,
                                right: -1,
                                width: 7,
                                height: 7,
                                borderRadius: 999,
                                background: "#22c55e",
                                border: "1.5px solid rgba(15,17,23,.9)",
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                    {members.length > 6 && (
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          marginLeft: -6,
                          background: "rgba(255,255,255,.06)",
                          border: "2px solid rgba(15,17,23,.9)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 9,
                          fontWeight: 700,
                          color: "rgba(255,255,255,.35)",
                          fontFamily: "monospace",
                        }}
                      >
                        +{members.length - 6}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isExpanded && (
                <div style={{ padding: "0 14px 12px" }}>
                  {crew.description && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--weered-muted)",
                        lineHeight: 1.5,
                        marginBottom: 10,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,.02)",
                        border: "1px solid rgba(255,255,255,.04)",
                      }}
                    >
                      {crew.description}
                    </div>
                  )}

                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}
                  >
                    {members.map((m: any) => {
                      const badge = roleBadge(m.role);
                      const bg = m.avatarColor || avatarBg(m.name || "?");
                      return (
                        <div
                          key={m.userId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 8px",
                            borderRadius: 8,
                            background: m.online ? "rgba(34,197,94,.04)" : "transparent",
                            transition: "background 0.15s",
                          }}
                        >
                          <div style={{ position: "relative" as const, flexShrink: 0 }}>
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: 999,
                                overflow: "hidden",
                                background: m.avatar
                                  ? "rgba(255,255,255,.08)"
                                  : bg || "rgba(255,255,255,.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#fff",
                              }}
                            >
                              {m.avatar ? (
                                <img
                                  src={m.avatar}
                                  alt={(m.name || "User") + " avatar"}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                (m.name || "?")[0]?.toUpperCase()
                              )}
                            </div>
                            <span
                              style={{
                                position: "absolute" as const,
                                bottom: -1,
                                right: -1,
                                width: 8,
                                height: 8,
                                borderRadius: 999,
                                background: m.online ? "#22c55e" : "rgba(255,255,255,.12)",
                                border: "2px solid rgba(15,17,23,.95)",
                              }}
                            />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: m.role === "LEADER" ? 800 : 600,
                                  color:
                                    m.role === "LEADER"
                                      ? "rgba(243,244,246,.95)"
                                      : "rgba(226,232,240,.8)",
                                }}
                              >
                                {m.name}
                              </span>
                              {badge && (
                                <span
                                  style={{
                                    fontSize: 8,
                                    fontWeight: 700,
                                    letterSpacing: "0.06em",
                                    padding: "1px 5px",
                                    borderRadius: 4,
                                    background: badge.bg,
                                    border: `1px solid ${badge.border}`,
                                    color: badge.color,
                                  }}
                                >
                                  {badge.label}
                                </span>
                              )}
                              {m.userId === myId && (
                                <span
                                  style={{
                                    fontSize: 8,
                                    fontWeight: 700,
                                    padding: "1px 4px",
                                    borderRadius: 4,
                                    background: "rgba(255,255,255,.06)",
                                    color: "rgba(255,255,255,.25)",
                                  }}
                                >
                                  YOU
                                </span>
                              )}
                            </div>
                            {m.online && m.roomName && (
                              <div
                                style={{ fontSize: 10, color: "rgba(74,222,128,.5)", marginTop: 1 }}
                              >
                                in {m.roomName}
                              </div>
                            )}
                          </div>

                          {m.online && m.roomId && m.userId !== myId && (
                            <button
                              onClick={() => onJoin(m.roomId)}
                              style={{
                                padding: "4px 10px",
                                borderRadius: 7,
                                fontSize: 10,
                                fontWeight: 700,
                                cursor: "pointer",
                                border: "1px solid rgba(88,0,229,.35)",
                                background: "rgba(88,0,229,.12)",
                                color: "rgba(167,139,250,.9)",
                                transition: "all 0.15s",
                              }}
                            >
                              Join
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {canManage && (
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <input
                        value={inviteInput[crew.id] || ""}
                        onChange={(e: any) =>
                          setInviteInput((v) => ({ ...v, [crew.id]: e.target.value }))
                        }
                        placeholder="Invite by username…"
                        style={{
                          flex: 1,
                          padding: "7px 10px",
                          borderRadius: 9,
                          border: "1px solid var(--weered-bd2)",
                          background: "rgba(255,255,255,.04)",
                          color: "var(--weered-text)",
                          outline: "none",
                          fontSize: 11,
                        }}
                        onKeyDown={(e: any) => {
                          if (e.key === "Enter") inviteMember(crew.id);
                        }}
                      />
                      <button
                        onClick={() => inviteMember(crew.id)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: 9,
                          fontSize: 11,
                          cursor: "pointer",
                          fontWeight: 700,
                          border: "1px solid rgba(88,0,229,.3)",
                          background: "rgba(88,0,229,.1)",
                          color: "rgba(167,139,250,.9)",
                        }}
                      >
                        +
                      </button>
                    </div>
                  )}
                  {inviteNote[crew.id] && (
                    <div
                      style={{
                        fontSize: 10,
                        marginBottom: 4,
                        color:
                          inviteNote[crew.id] === "Invited!"
                            ? "rgba(74,222,128,.7)"
                            : "rgba(252,165,165,.7)",
                      }}
                    >
                      {inviteNote[crew.id]}
                    </div>
                  )}

                  <div
                    style={{
                      marginBottom: 8,
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,.06)",
                      overflow: "hidden",
                      height: 260,
                    }}
                  >
                    <CrewChatPanel
                      crewId={crew.id}
                      crewName={crew.name}
                      myId={myId}
                      myName={myName}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    {isLeader ? (
                      <button
                        onClick={() => disbandCrew(crew.id)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 7,
                          border: "1px solid rgba(239,68,68,.25)",
                          background: "rgba(239,68,68,.06)",
                          color: "rgba(252,165,165,.7)",
                          fontSize: 10,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Disband Crew
                      </button>
                    ) : (
                      <button
                        onClick={() => leaveCrew(crew.id)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 7,
                          border: "1px solid var(--weered-bd)",
                          background: "transparent",
                          color: "var(--weered-muted)",
                          fontSize: 10,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Leave Crew
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
