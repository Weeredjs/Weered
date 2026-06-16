"use client";

import React from "react";
import { avatarBg } from "../../lib/avatarColor";
import RoleIcon from "../RoleIcon";
import { CrewFlair } from "./flair";
import { nameStyleFor } from "./chatShared";

type ChatMembersProps = {
  ctx: any;
  liveRoomUsers: any[];
  openHover: (id: string, name: string, el: HTMLElement) => void;
  hoverClose: (ms?: number) => void;
};

export function ChatMembers({ ctx, liveRoomUsers, openHover, hoverClose }: ChatMembersProps) {
  return (
    <aside className="weered-chat-members" aria-label="Room members">
      {(() => {
        const roomUsers: any[] = liveRoomUsers;
        if (roomUsers.length === 0) {
          return (
            <div
              style={{
                fontSize: 12,
                color: "var(--weered-muted, rgba(148,163,184,.55))",
                fontStyle: "italic",
                padding: "8px 0",
              }}
            >
              No one's in here yet.
            </div>
          );
        }
        const rankOf = (u: any) => {
          const r = String(u?.globalRole || "").toUpperCase();
          const t = String(u?.tier || "").toUpperCase();
          if (r === "GOD") return 0;
          if (r === "STAFF" || r === "ADMIN") return 1;
          if (r === "SUPPORT") return 2;
          if (r === "MOD") return 3;
          if (t === "KINGPIN") return 4;
          if (t === "FELON") return 5;
          if (t === "INDICTED") return 6;
          return 7;
        };
        const sorted = [...roomUsers].sort((a, b) => {
          const d = rankOf(a) - rankOf(b);
          if (d !== 0) return d;
          return String(a?.name || "").localeCompare(String(b?.name || ""));
        });
        const myId = String(ctx?.me?.id || "");
        return (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "var(--weered-muted, rgba(148,163,184,.7))",
                marginBottom: 10,
              }}
            >
              In the room · {sorted.length}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {sorted.map((u: any) => {
                const role = String(u?.globalRole || "").toUpperCase();
                const tier = String(u?.tier || "").toUpperCase();
                const ns = nameStyleFor(role, tier);
                const isMe = myId && u.id === myId;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      if (!u.id || u.id === myId) return;
                      try {
                        window.dispatchEvent(
                          new CustomEvent("weered:dock:open", {
                            detail: { mode: "dm", peer: { id: u.id, name: u.name } },
                          }),
                        );
                      } catch {}
                    }}
                    onMouseEnter={(e) => {
                      if (u.id) openHover(u.id, u.name, e.currentTarget as HTMLElement);
                    }}
                    onMouseLeave={() => hoverClose(160)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "6px 8px",
                      border: "1px solid transparent",
                      borderRadius: 6,
                      background: "transparent",
                      cursor: isMe ? "default" : "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      transition: "background .12s, border-color .12s",
                    }}
                    onMouseOver={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.04)";
                      (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.08)";
                    }}
                    onMouseOut={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                      (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        flexShrink: 0,
                        background: u?.avatar
                          ? "rgba(255,255,255,.08)"
                          : avatarBg(String(u?.name || "?"), false, u?.avatarColor),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#fff",
                        overflow: "hidden",
                      }}
                    >
                      {u?.avatar ? (
                        <img
                          src={u.avatar}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        String(u?.name || "?")
                          .slice(0, 1)
                          .toUpperCase()
                      )}
                    </div>
                    <span
                      style={{
                        ...ns,
                        fontSize: 12,
                        fontWeight: 700,
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {u?.name}
                      {isMe && (
                        <span
                          style={{
                            color: "var(--weered-muted, rgba(148,163,184,.55))",
                            fontWeight: 500,
                            marginLeft: 4,
                            fontStyle: "italic",
                          }}
                        >
                          (you)
                        </span>
                      )}
                    </span>
                    {role && role !== "USER" && <RoleIcon role={role} size={11} />}
                    {u.id && <CrewFlair userId={u.id} size={11} />}
                  </button>
                );
              })}
            </div>
          </>
        );
      })()}
    </aside>
  );
}
