"use client";
import { useState } from "react";
import LobbyBranding, { type BrandingValue } from "../../../../components/LobbyBranding";
import { LobbyData, S, apiFetch } from "./shared";
import { MemberPerksEditor } from "./MemberPerksEditor";

export function BrandingTab({ lobby, onRefresh }: { lobby: LobbyData; onRefresh: () => void }) {
  const [name, setName] = useState(lobby.name);
  const [description, setDescription] = useState(lobby.description);
  const [accentColor, setAccentColor] = useState(lobby.accentColor || "");
  const [logoUrl, setLogoUrl] = useState(lobby.logoUrl || "");
  const [bannerUrl, setBannerUrl] = useState(lobby.bannerUrl || "");
  const [websiteUrl, setWebsiteUrl] = useState(lobby.websiteUrl || "");
  const [keywords, setKeywords] = useState(lobby.keywords.join(", "));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [joinMode, setJoinMode] = useState(lobby.joinMode || "OPEN");
  const [joinPassword, setJoinPassword] = useState(lobby.joinPassword || "");
  const [joinSaving, setJoinSaving] = useState(false);
  const [joinMsg, setJoinMsg] = useState("");

  async function saveJoinMode() {
    setJoinSaving(true);
    setJoinMsg("");
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/join-mode`, {
      method: "PATCH",
      body: JSON.stringify({ joinMode, password: joinPassword }),
    });
    setJoinSaving(false);
    setJoinMsg(j.ok ? "Saved." : j.error || "Failed.");
    if (j.ok) onRefresh();
  }

  async function save() {
    setSaving(true);
    setMsg("");
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/branding`, {
      method: "PATCH",
      body: JSON.stringify({
        name,
        description,
        accentColor: accentColor || null,
        logoUrl: logoUrl || null,
        bannerUrl: bannerUrl || null,
        websiteUrl: websiteUrl || null,
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      }),
    });
    setSaving(false);
    setMsg(j.ok ? "Saved." : j.error || "Failed.");
    if (j.ok) onRefresh();
  }

  const Field = ({
    label,
    value,
    onChange,
    placeholder,
    multiline,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    multiline?: boolean;
  }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={S.label}>{label}</div>
      {multiline ? (
        <textarea
          style={{ ...S.input, resize: "vertical", minHeight: 60 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          style={S.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );

  const brandingValue: BrandingValue = {
    name,
    description,
    accentColor: accentColor || "#7c3aed",
    logoUrl,
    bannerUrl,
  };
  const patchBranding = (p: Partial<BrandingValue>) => {
    if (p.name !== undefined) setName(p.name);
    if (p.description !== undefined) setDescription(p.description);
    if (p.accentColor !== undefined) setAccentColor(p.accentColor);
    if (p.logoUrl !== undefined) setLogoUrl(p.logoUrl);
    if (p.bannerUrl !== undefined) setBannerUrl(p.bannerUrl);
  };

  return (
    <div style={{ maxWidth: 880 }}>
      <LobbyBranding value={brandingValue} onChange={patchBranding} />

      <div style={{ marginTop: 20, maxWidth: 560 }}>
        <Field
          label="Website URL"
          value={websiteUrl}
          onChange={setWebsiteUrl}
          placeholder="https://..."
        />
        <Field
          label="Keywords (comma-separated)"
          value={keywords}
          onChange={setKeywords}
          placeholder="gaming, destiny, fps"
        />
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
        <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Branding"}
        </button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>

      <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ ...S.label, marginBottom: 12 }}>MEMBERSHIP GATING</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {(["OPEN", "APPROVAL", "PASSWORD", "PAID"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setJoinMode(m)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                border:
                  joinMode === m
                    ? "1px solid rgba(200,155,60,.45)"
                    : "1px solid rgba(255,255,255,.08)",
                background: joinMode === m ? "rgba(200,155,60,.12)" : "rgba(255,255,255,.03)",
                color: joinMode === m ? "rgb(200,155,60)" : "rgba(148,163,184,.6)",
              }}
            >
              {m === "OPEN"
                ? "Open"
                : m === "APPROVAL"
                  ? "Approval"
                  : m === "PASSWORD"
                    ? "Password"
                    : "Paid Tier"}
            </button>
          ))}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(148,163,184,.45)",
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          {joinMode === "OPEN" && "Anyone can join this lobby instantly."}
          {joinMode === "APPROVAL" &&
            "Users submit a request. Moderators approve or deny from the Join Requests tab."}
          {joinMode === "PASSWORD" && "Users must enter the correct password to join."}
          {joinMode === "PAID" &&
            "Users must subscribe to a paid tier to join. Configure tiers in the Paid Tiers tab."}
        </div>
        {joinMode === "PASSWORD" && (
          <div style={{ marginBottom: 12 }}>
            <div style={S.label}>Lobby Password</div>
            <input
              style={S.input}
              type="text"
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>
        )}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            style={{ ...S.btnPri, padding: "8px 20px" }}
            onClick={saveJoinMode}
            disabled={joinSaving}
          >
            {joinSaving ? "Saving..." : "Save Join Mode"}
          </button>
          {joinMsg && <span style={{ fontSize: 12, opacity: 0.7 }}>{joinMsg}</span>}
        </div>
      </div>

      <MemberPerksEditor lobby={lobby} onRefresh={onRefresh} />
    </div>
  );
}
