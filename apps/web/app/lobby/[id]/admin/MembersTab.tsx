"use client";
import { useState } from "react";
import { weeredConfirm } from "../../../../lib/confirm";
import { AdminMember, LevelBadge, S, apiFetch, fmtDate } from "./shared";

export function MembersTab({
  lobbyId,
  initialMembers,
  roleNames,
  myLevel,
  perms,
  overrideRole,
  onRefresh,
}: {
  lobbyId: string;
  initialMembers: AdminMember[];
  roleNames: Record<string, string>;
  myLevel: number;
  perms: string[];
  overrideRole: string | null;
  onRefresh: () => void;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [selected, setSelected] = useState<AdminMember | null>(null);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("");
  const canKick = perms.includes("kick");
  const canBan = perms.includes("ban");
  const canRole = perms.includes("manage_roles");

  async function setRole(userId: string, roleLevel: number) {
    const j = await apiFetch(
      `/lobbies/${encodeURIComponent(lobbyId)}/admin/members/${userId}/role`,
      {
        method: "POST",
        body: JSON.stringify({ roleLevel }),
      },
    );
    if (j.ok) {
      setMsg(`Updated role for ${userId}`);
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, roleLevel } : m)));
      onRefresh();
    } else setMsg(j.error || "Failed.");
  }

  async function kickMember(userId: string, name: string) {
    const ok = await weeredConfirm({
      title: `Kick ${name}?`,
      body: "They'll be removed from the lobby. They can rejoin unless you ban them.",
      confirmLabel: "Kick",
      destructive: true,
    });
    if (!ok) return;
    const j = await apiFetch(
      `/lobbies/${encodeURIComponent(lobbyId)}/admin/members/${userId}/kick`,
      { method: "POST" },
    );
    if (j.ok) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      setSelected(null);
      setMsg(`Kicked ${name}`);
    } else setMsg(j.error || "Failed.");
  }

  async function banMember(userId: string, name: string) {
    const reason = prompt(`Ban reason for ${name}:`);
    if (reason === null) return;
    const j = await apiFetch(
      `/lobbies/${encodeURIComponent(lobbyId)}/admin/members/${userId}/ban`,
      {
        method: "POST",
        body: JSON.stringify({ reason }),
      },
    );
    if (j.ok) {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      setSelected(null);
      setMsg(`Banned ${name}`);
    } else setMsg(j.error || "Failed.");
  }

  const filtered = filter.trim()
    ? members.filter((m) => m.name.toLowerCase().includes(filter.toLowerCase()))
    : members;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1.2fr",
        gap: 16,
        alignItems: "start",
        height: "100%",
      }}
    >
      <div>
        <input
          style={{ ...S.input, marginBottom: 10 }}
          placeholder="Search members..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {filtered.map((m) => (
            <div
              key={m.id}
              onClick={() => setSelected(m)}
              style={{
                ...(selected?.id === m.id ? S.cardHov : S.card),
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  background: "rgba(124,58,237,.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {(m.name || "?")[0].toUpperCase()}
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.name || m.userId}
              </div>
              <LevelBadge level={m.roleLevel} roleNames={roleNames} />
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ opacity: 0.4, fontSize: 13, padding: 12 }}>No members found.</div>
          )}
        </div>
      </div>

      {selected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={S.card}>
            <div style={S.sectionTitle}>Member Details</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  background: "rgba(124,58,237,.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                {(selected.name || "?")[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{selected.name}</div>
                <div style={{ fontSize: 11, opacity: 0.4, marginTop: 1 }}>
                  Joined: {fmtDate(selected.createdAt)}
                </div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <LevelBadge level={selected.roleLevel} roleNames={roleNames} />
              </div>
            </div>
            <div style={{ fontSize: 11, opacity: 0.4, fontFamily: "monospace" }}>
              ID: {selected.userId}
            </div>
          </div>

          {canRole && (
            <div style={S.card}>
              <div style={S.sectionTitle}>Set Role</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {[1, 2, 3, 4]
                  .filter((lvl) => overrideRole || lvl < myLevel)
                  .map((lvl) => (
                    <button
                      key={lvl}
                      style={{ ...S.btn, fontSize: 11 }}
                      onClick={() => setRole(selected.userId, lvl)}
                    >
                      {roleNames[String(lvl)] || `Level ${lvl}`}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            {canKick && (
              <button style={S.danger} onClick={() => kickMember(selected.userId, selected.name)}>
                Kick
              </button>
            )}
            {canBan && (
              <button
                style={{ ...S.danger, borderColor: "rgba(239,68,68,.50)" }}
                onClick={() => banMember(selected.userId, selected.name)}
              >
                Ban
              </button>
            )}
          </div>
          {msg && <div style={{ fontSize: 12, opacity: 0.7 }}>{msg}</div>}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 200,
            opacity: 0.3,
            fontSize: 13,
          }}
        >
          Select a member
        </div>
      )}
    </div>
  );
}

export type AdminTier = {
  id: string;
  name: string;
  description: string;
  priceMonthly: number;
  grantLevel: number;
  color: string | null;
  sortOrder: number;
  active: boolean;
  stripePriceId: string | null;
  _count?: { subscribers: number };
};
