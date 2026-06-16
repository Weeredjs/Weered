"use client";
import { useState, useEffect } from "react";
import { RoleBadge, S, apiFetch, fmtDate, roleColor } from "./shared";

export function RosterTab() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/staff/roster")
      .then((j) => {
        setStaff(j.staff || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return <div style={{ textAlign: "center", padding: 20, opacity: 0.4 }}>Loading roster...</div>;

  const grouped: Record<string, any[]> = {};
  for (const u of staff) {
    const r = u.globalRole || "STAFF";
    if (!grouped[r]) grouped[r] = [];
    grouped[r].push(u);
  }
  const order = ["GOD", "ADMIN", "STAFF", "SUPPORT"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ fontSize: 13, opacity: 0.5 }}>{staff.length} staff members</div>
      {order
        .filter((r) => grouped[r]?.length)
        .map((r) => (
          <div key={r}>
            <div style={S.sectionTitle}>
              {r} ({grouped[r].length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {grouped[r].map((u: any) => {
                const rc = roleColor(u.globalRole);
                return (
                  <div
                    key={u.id}
                    style={{ ...S.card, display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        background: u.avatarColor || "rgba(124,58,237,.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 700,
                        flexShrink: 0,
                        border: `2px solid ${rc.border}`,
                      }}
                    >
                      {(u.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{u.name}</div>
                      <div style={{ fontSize: 10, opacity: 0.4 }}>
                        joined {fmtDate(u.createdAt)}
                      </div>
                    </div>
                    <RoleBadge role={u.globalRole} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
