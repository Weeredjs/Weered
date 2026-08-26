"use client";
import { useState } from "react";
import { LEVEL_COLORS, LobbyData, S, apiFetch } from "./shared";

export const DEFAULT_ROLE_NAMES: Record<string, string> = {
  "5": "Owner",
  "4": "Admin",
  "3": "Moderator",
  "2": "Trusted",
  "1": "Member",
};

export const LEVEL_PERMS_DISPLAY: Record<number, string[]> = {
  5: [
    "Full control",
    "Manage roles",
    "Edit branding",
    "Manage rooms",
    "Kick/Ban",
    "Pin rooms",
    "Admin chat",
  ],
  4: ["Edit branding", "Manage rooms", "Kick/Ban", "Pin rooms", "Admin chat"],
  3: ["Manage rooms", "Kick/Ban", "Pin rooms", "Admin chat"],
  2: ["Kick users", "Admin chat"],
  1: ["Base access"],
};

export const DEFAULT_ROLE_ICONS: Record<string, string> = {
  "5": "",
  "4": "",
  "3": "",
  "2": "",
  "1": "",
};

/** A starting palette for the icon field. Anything typed or pasted works —
 *  these are just one click away for owners who don't want to hunt for an
 *  emoji picker. Leaving a level blank means no icon, which is the default. */
const ICON_SUGGESTIONS = ["👑", "🛡️", "🔧", "⭐", "🎖️", "🏁", "🔰", "💠", "⚑", "🅥"];

export function RolesTab({ lobby, onRefresh }: { lobby: LobbyData; onRefresh: () => void }) {
  const [names, setNames] = useState<Record<string, string>>(lobby.roleNames || DEFAULT_ROLE_NAMES);
  const [icons, setIcons] = useState<Record<string, string>>(lobby.roleIcons || DEFAULT_ROLE_ICONS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg("");
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/roles`, {
      method: "PATCH",
      body: JSON.stringify({ roleNames: names, roleIcons: icons }),
    });
    setSaving(false);
    setMsg(j.ok ? "Saved." : j.error || "Failed.");
    if (j.ok) onRefresh();
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={S.sectionTitle}>Custom Role Titles</div>
      <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 16 }}>
        Rename roles to match your community and give each one an icon that shows beside
        members&apos; names. Permissions are fixed per level.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {[5, 4, 3, 2, 1].map((lvl) => {
          const c = LEVEL_COLORS[lvl];
          const perms = LEVEL_PERMS_DISPLAY[lvl] || [];
          return (
            <div
              key={lvl}
              style={{
                borderRadius: 10,
                border: `1px solid ${c.border}`,
                background: c.bg,
                padding: "12px 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: c.color, width: 24 }}>
                  L{lvl}
                </span>
                <input
                  style={{ ...S.input, background: "rgba(0,0,0,.25)", flex: 1 }}
                  value={names[String(lvl)] || ""}
                  onChange={(e) => setNames((prev) => ({ ...prev, [String(lvl)]: e.target.value }))}
                  placeholder={DEFAULT_ROLE_NAMES[String(lvl)]}
                  maxLength={24}
                />
                <button
                  type="button"
                  onClick={() => setPickerFor(pickerFor === String(lvl) ? null : String(lvl))}
                  title={
                    icons[String(lvl)] ? "Change this role's icon" : "Add an icon for this role"
                  }
                  aria-label={`Icon for ${names[String(lvl)] || DEFAULT_ROLE_NAMES[String(lvl)]}`}
                  style={{
                    width: 40,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                    border: `1px solid ${pickerFor === String(lvl) ? c.color : "rgba(255,255,255,.14)"}`,
                    background: "rgba(0,0,0,.25)",
                    color: "rgba(243,244,246,.9)",
                  }}
                >
                  {icons[String(lvl)] || "+"}
                </button>
              </div>

              {pickerFor === String(lvl) && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    alignItems: "center",
                    padding: "8px 10px",
                    marginBottom: 8,
                    borderRadius: 8,
                    background: "rgba(0,0,0,.22)",
                    border: "1px solid rgba(255,255,255,.08)",
                  }}
                >
                  {ICON_SUGGESTIONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => {
                        setIcons((prev) => ({ ...prev, [String(lvl)]: ic }));
                        setPickerFor(null);
                      }}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 15,
                        border: "1px solid rgba(255,255,255,.10)",
                        background: "rgba(255,255,255,.04)",
                      }}
                    >
                      {ic}
                    </button>
                  ))}
                  <input
                    style={{ ...S.input, background: "rgba(0,0,0,.3)", width: 80, fontSize: 13 }}
                    value={icons[String(lvl)] || ""}
                    onChange={(e) =>
                      setIcons((prev) => ({ ...prev, [String(lvl)]: e.target.value.slice(0, 8) }))
                    }
                    placeholder="or type"
                    maxLength={8}
                    aria-label="Custom icon"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIcons((prev) => ({ ...prev, [String(lvl)]: "" }));
                      setPickerFor(null);
                    }}
                    style={{
                      ...S.btn,
                      padding: "4px 10px",
                      fontSize: 11,
                    }}
                  >
                    None
                  </button>
                </div>
              )}
              <div
                style={{ fontSize: 11, opacity: 0.6, display: "flex", flexWrap: "wrap", gap: 4 }}
              >
                {perms.map((p) => (
                  <span
                    key={p}
                    style={{
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: "rgba(0,0,0,.20)",
                      fontSize: 10,
                    }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Roles"}
        </button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>
    </div>
  );
}
