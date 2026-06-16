"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWeered } from "../../components/WeeredProvider";
import LobbyChatPanel from "../../components/LobbyChatPanel";
import AnalyticsTab from "../../components/AnalyticsTab";
import { GlobalRole, NAV_ITEMS, NavId, RoleBadge, S, apiFetch, canSeeNav } from "./shared";
import { PermissionsTab } from "./PermissionsTab";
import { OpsPresence } from "./OpsPresence";
import { UsersTab } from "./UsersTab";
import { SubsTab } from "./SubsTab";
import { RoomsTab } from "./RoomsTab";
import { LobbiesTab } from "./LobbiesTab";
import { AppealsTab } from "./AppealsTab";
import { BugsTab } from "./BugsTab";
import { ReportsTab } from "./ReportsTab";
import { AuditTab } from "./AuditTab";
import { BroadcastTab } from "./BroadcastTab";
import { EventsTab } from "./EventsTab";
import { RosterTab } from "./RosterTab";
import { BoardTab } from "./BoardTab";
import { FilesTab } from "./FilesTab";
import { ModsAdminTab } from "./ModsAdminTab";
import { ConfigTab } from "./ConfigTab";
import { OutreachTab } from "./OutreachTab";

export default function StaffPage() {
  const router = useRouter();
  const ctx = useWeered() as any;

  const [myRole, setMyRole] = useState<GlobalRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [nav, setNav] = useState<NavId>("users");

  useEffect(() => {
    try {
      ctx?.setActiveRoomId?.("@ops");
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiFetch("/staff/me")
      .then((j) => {
        if (!j.ok || !["SUPPORT", "STAFF", "ADMIN", "GOD"].includes(j.globalRole)) {
          router.replace("/lobby");
          return;
        }
        setMyRole(j.globalRole);
        setLoading(false);
      })
      .catch(() => router.replace("/lobby"));
  }, []);

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
        Checking access…
      </div>
    );

  if (!myRole) return null;

  const visibleNav = NAV_ITEMS.filter((n) => canSeeNav(myRole, n.minRole));

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
          borderBottom: "1px solid rgba(255,255,255,.08)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
              weered ops
            </span>
            <span style={{ fontSize: 11, opacity: 0.4, marginLeft: 10 }}>
              staff area · {myRole}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <RoleBadge role={myRole} />
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("weered:dock:toggle"))}
            style={{
              fontSize: 12,
              opacity: 0.55,
              padding: "5px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,.10)",
              background: "rgba(255,255,255,.04)",
              cursor: "pointer",
              color: "inherit",
            }}
          >
            DMs
          </button>
          <a
            href="/lobby"
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

      <div
        className="weered-ops-mobile-nav"
        style={{
          display: "none",
          overflowX: "auto",
          gap: 4,
          padding: "8px 10px",
          borderBottom: "1px solid rgba(255,255,255,.07)",
          scrollbarWidth: "none",
          flexShrink: 0,
        }}
      >
        {visibleNav.map((item) => (
          <button
            key={item.id}
            onClick={() => setNav(item.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "6px 12px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
              background: nav === item.id ? "rgba(124,58,237,.18)" : "transparent",
              color: nav === item.id ? "rgba(216,180,254,.95)" : "rgba(148,163,184,.6)",
              fontWeight: nav === item.id ? 700 : 500,
              fontSize: 12,
              fontFamily: "inherit",
              transition: "all .12s",
            }}
          >
            <span style={{ fontSize: 12 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div
        className="weered-ops-body"
        style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "200px 1fr 280px" }}
      >
        <div
          className="weered-ops-sidebar"
          style={{
            borderRight: "1px solid rgba(255,255,255,.07)",
            padding: "14px 10px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 2,
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
                background: nav === item.id ? "rgba(124,58,237,.15)" : "transparent",
                color: nav === item.id ? "rgba(216,180,254,.95)" : "rgba(148,163,184,.75)",
                fontWeight: nav === item.id ? 700 : 400,
                fontSize: 13,
                fontFamily: "inherit",
                transition: "background .1s",
              }}
            >
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div
            style={{
              marginTop: "auto",
              paddingTop: 16,
              borderTop: "1px solid rgba(255,255,255,.06)",
            }}
          >
            <OpsPresence />
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
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
            {nav === "users" && <UsersTab myRole={myRole} />}
            {nav === "board" && <BoardTab myRole={myRole} />}
            {nav === "analytics" && <AnalyticsTab />}
            {nav === "roster" && <RosterTab />}
            {nav === "subs" && <SubsTab />}
            {nav === "rooms" && <RoomsTab myRole={myRole} />}
            {nav === "lobbies" && <LobbiesTab myRole={myRole} />}
            {nav === "events" && <EventsTab />}
            {nav === "audit" && <AuditTab />}
            {nav === "broadcast" && <BroadcastTab />}
            {nav === "reports" && <ReportsTab />}
            {nav === "appeals" && <AppealsTab />}
            {nav === "bugs" && <BugsTab />}
            {nav === "outreach" && <OutreachTab />}
            {nav === "mods" && <ModsAdminTab />}
            {nav === "permissions" && <PermissionsTab />}
            {nav === "files" && <FilesTab />}
            {nav === "config" && <ConfigTab />}
          </div>
        </div>

        <div
          className="weered-ops-chat"
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
            <div style={{ fontWeight: 700, fontSize: 13 }}>Ops Chat</div>
            <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>#ops · staff only</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: "0 10px 10px" }}>
            <LobbyChatPanel
              roomId="@ops"
              embedded
              style={{ height: "100%", display: "flex", flexDirection: "column" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
