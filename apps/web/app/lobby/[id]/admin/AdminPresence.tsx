"use client";
import { useWeered, useRoomUsers } from "../../../../components/WeeredProvider";
import { S } from "./shared";

export function AdminPresence() {
  const ctx = useWeered();
  const users: any[] = useRoomUsers(ctx?.activeRoomId);

  return (
    <div>
      <div style={S.label}>Team Online · {users.length}</div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          maxHeight: 220,
          overflowY: "auto",
          paddingRight: 4,
        }}
      >
        {users.length === 0 && <div style={{ fontSize: 11, opacity: 0.35 }}>No one else here.</div>}
        {users.map((u: any, i: number) => {
          const name = String(u?.name ?? "?");
          return (
            <div
              key={u?.id ?? i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 8px",
                borderRadius: 8,
                background: "rgba(255,255,255,.03)",
                border: "1px solid rgba(255,255,255,.06)",
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
                {name.slice(0, 1).toUpperCase()}
              </div>
              <div
                style={{
                  minWidth: 0,
                  flex: 1,
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
