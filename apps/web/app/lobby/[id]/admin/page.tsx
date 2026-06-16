"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useWeered } from "../../../../components/WeeredProvider";
import LobbyChatPanel from "../../../../components/LobbyChatPanel";
import RoomStage from "../../../../components/room/RoomStage";
import { DashboardData, LevelBadge, NAV_ITEMS, NavId, OverrideBadge, S, apiFetch } from "./shared";
import { AdminPresence } from "./AdminPresence";
import { AuditTab } from "./AuditTab";
import { BrandingTab } from "./BrandingTab";
import { ChallengesTab } from "./ChallengesTab";
import { JoinRequestsTab } from "./JoinRequestsTab";
import { LobbyEventsTab } from "./LobbyEventsTab";
import { MembersTab } from "./MembersTab";
import { ModerationTab } from "./ModerationTab";
import { ModulesTab } from "./ModulesTab";
import { DEFAULT_ROLE_NAMES, RolesTab } from "./RolesTab";
import { RoomsTab } from "./RoomsTab";
import { TiersTab } from "./TiersTab";
import { TournamentsTab } from "./TournamentsTab";

export default function LobbyAdminPage() {
  const params = useParams();
  const ctx = useWeered() as any;

  const lobbyId = decodeURIComponent(String(params?.id || ""));

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nav, setNav] = useState<NavId>("branding");
  const [voiceOpen, setVoiceOpen] = useState(false);

  const adminRoomId = `@admin-${lobbyId}`;

  useEffect(() => {
    try {
      ctx?.join?.(adminRoomId);
    } catch {}
    try {
      ctx?.setActiveRoomId?.(adminRoomId);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminRoomId]);

  const load = useCallback(async () => {
    try {
      const j = await apiFetch(`/lobbies/${encodeURIComponent(lobbyId)}/admin`);
      if (!j.ok) {
        setError(j.error || "Access denied");
        setLoading(false);
        return;
      }
      setData(j);
      setLoading(false);
    } catch {
      setError("Failed to load admin data");
      setLoading(false);
    }
  }, [lobbyId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--weered-bg, #080810)",
          color: "rgba(243,244,246,.4)",
          fontFamily: "monospace",
          fontSize: 13,
        }}
      >
        Loading admin panel...
      </div>
    );

  if (error || !data)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--weered-bg, #080810)",
          color: "rgba(243,244,246,.5)",
          fontFamily: "monospace",
          fontSize: 13,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
            {error || "Access denied"}
          </div>
          <a
            href={`/lobby/${encodeURIComponent(lobbyId)}`}
            style={{ color: "rgb(216,180,254)", textDecoration: "underline" }}
          >
            Back to lobby
          </a>
        </div>
      </div>
    );

  const { lobby, members, rooms: adminRooms, audit, bans, myLevel, overrideRole, perms } = data;
  const roleNames = lobby.roleNames || DEFAULT_ROLE_NAMES;
  const visibleNav = NAV_ITEMS.filter((n) => overrideRole || myLevel >= n.minLevel);
  const accent = lobby.accentColor || "rgba(124,58,237,1)";

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--weered-bg, #080810)",
        color: "rgba(243,244,246,.92)",
        fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          borderBottom: `1px solid ${accent}25`,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          background: `${accent}08`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lobby.logoUrl && (
            <img
              src={lobby.logoUrl}
              alt={`${lobby.name || lobbyId} logo`}
              style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }}
            />
          )}
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "rgba(16,185,129,.85)",
              boxShadow: "0 0 6px rgba(16,185,129,.5)",
            }}
          />
          <div>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-.3px" }}>
              {lobby.name || lobbyId}
            </span>
            <span style={{ fontSize: 11, opacity: 0.4, marginLeft: 10 }}>admin panel</span>
          </div>
          {lobby.verified && (
            <span
              style={{
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 999,
                border: "1px solid rgba(16,185,129,.30)",
                color: "rgb(110,231,183)",
                background: "rgba(16,185,129,.08)",
              }}
            >
              VERIFIED
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {overrideRole && <OverrideBadge role={overrideRole} />}
          <LevelBadge level={myLevel} roleNames={roleNames} />
          <button
            onClick={() => setVoiceOpen(!voiceOpen)}
            style={{ ...S.btn, fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}
          >
            {voiceOpen ? "🔇" : "🎙"} Voice
          </button>
          <a
            href={`/lobby/${encodeURIComponent(lobbyId)}`}
            style={{
              fontSize: 12,
              opacity: 0.55,
              textDecoration: "none",
              padding: "5px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.10)",
              background: "rgba(255,255,255,.04)",
            }}
          >
            ← Lobby
          </a>
        </div>
      </div>

      {voiceOpen && (
        <RoomStage
          roomId={adminRoomId}
          mode="voice"
          onClose={() => setVoiceOpen(false)}
          style={{ flexShrink: 0 }}
        />
      )}

      <div
        style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "200px 1fr 280px" }}
      >
        <div
          style={{
            borderRight: "1px solid rgba(255,255,255,.07)",
            padding: "14px 10px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            minHeight: 0,
          }}
        >
          <div style={{ ...S.label, marginBottom: 8 }}>Navigation</div>
          {visibleNav.map((item) => (
            <button
              key={item.id}
              onClick={() => setNav(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "8px 10px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
                background: nav === item.id ? `${accent}20` : "transparent",
                color: nav === item.id ? "rgba(216,180,254,.95)" : "rgba(148,163,184,.75)",
                fontWeight: nav === item.id ? 700 : 400,
                fontSize: 13,
                transition: "background .1s",
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div
            style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,.06)" }}
          >
            <div style={S.label}>Stats</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.6 }}>
                <span>Members</span>
                <span style={{ fontWeight: 700 }}>{members.length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.6 }}>
                <span>Rooms</span>
                <span style={{ fontWeight: 700 }}>{adminRooms.length}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", opacity: 0.6 }}>
                <span>Bans</span>
                <span style={{ fontWeight: 700 }}>{bans.length}</span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "auto",
              paddingTop: 16,
              borderTop: "1px solid rgba(255,255,255,.06)",
            }}
          >
            <AdminPresence />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 20px 12px",
              borderBottom: "1px solid rgba(255,255,255,.07)",
              flexShrink: 0,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 15 }}>
              {visibleNav.find((n) => n.id === nav)?.icon}{" "}
              {visibleNav.find((n) => n.id === nav)?.label}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 80px" }}>
            {nav === "branding" && <BrandingTab lobby={lobby} onRefresh={load} />}
            {nav === "modules" && <ModulesTab lobby={lobby} onRefresh={load} />}
            {nav === "moderation" && <ModerationTab lobby={lobby} onRefresh={load} />}
            {nav === "rooms" && (
              <RoomsTab
                lobbyId={lobbyId}
                initialRooms={adminRooms}
                perms={perms}
                onRefresh={load}
              />
            )}
            {nav === "challenges" && <ChallengesTab lobbyId={lobbyId} />}
            {nav === "tournaments" && <TournamentsTab lobbyId={lobbyId} />}
            {nav === "roles" && <RolesTab lobby={lobby} onRefresh={load} />}
            {nav === "tiers" && (
              <TiersTab lobbyId={lobbyId} roleNames={roleNames} onRefresh={load} />
            )}
            {nav === "join-requests" && <JoinRequestsTab lobbyId={lobbyId} />}
            {nav === "events" && (
              <LobbyEventsTab
                lobbyId={lobbyId}
                myLevel={myLevel}
                overrideRole={overrideRole}
                onRefresh={load}
              />
            )}
            {nav === "members" && (
              <MembersTab
                lobbyId={lobbyId}
                initialMembers={members}
                roleNames={roleNames}
                myLevel={myLevel}
                perms={perms}
                overrideRole={overrideRole}
                onRefresh={load}
              />
            )}
            {nav === "audit" && <AuditTab initialLogs={audit} />}
          </div>
        </div>

        <div
          style={{
            borderLeft: "1px solid rgba(255,255,255,.07)",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            style={{
              padding: "14px 14px 10px",
              borderBottom: "1px solid rgba(255,255,255,.07)",
              flexShrink: 0,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>Team Chat</div>
            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>
              #{adminRoomId} · admin only
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: "0 10px 10px" }}>
            <LobbyChatPanel
              roomId={adminRoomId}
              embedded
              style={{ height: "100%", display: "flex", flexDirection: "column" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
