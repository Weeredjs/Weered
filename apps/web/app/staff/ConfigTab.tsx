"use client";
import React, { useState, useEffect } from "react";
import { S, SiteConfig, apiFetch } from "./shared";

export function ConfigTab() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [lobbies, setLobbies] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    Promise.all([apiFetch("/staff/config"), apiFetch("/staff/lobbies")]).then(
      ([configData, lobbyData]) => {
        if (configData.ok) setConfig(configData.config);
        setLobbies((lobbyData.lobbies || []).map((l: any) => ({ id: l.id, name: l.name })));
        setLoading(false);
      },
    );
  }, []);

  async function save() {
    if (!config) return;
    setSaving(true);
    setMsg("");
    const j = await apiFetch("/staff/config", { method: "POST", body: JSON.stringify(config) });
    setSaving(false);
    setMsg(j.ok ? "Saved." : j.error || "Failed.");
  }

  if (loading) return <div style={{ opacity: 0.4 }}>Loading…</div>;
  if (!config) return <div style={{ opacity: 0.4 }}>Config unavailable.</div>;

  const toggle = (key: keyof SiteConfig) => setConfig((c) => (c ? { ...c, [key]: !c[key] } : c));
  const num = (key: keyof SiteConfig, val: string) =>
    setConfig((c) => (c ? { ...c, [key]: Number(val) } : c));

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        borderRadius: 9,
        border: "1px solid rgba(255,255,255,.07)",
        background: "rgba(255,255,255,.02)",
        marginBottom: 6,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );

  const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        width: 44,
        height: 24,
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        background: on ? "rgba(16,185,129,.7)" : "rgba(255,255,255,.12)",
        position: "relative",
        transition: "background .15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: 999,
          background: "#fff",
          transition: "left .15s",
        }}
      />
    </button>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      <Row label="Featured Hero Lobby">
        <select
          value={config.featuredLobbyId || ""}
          onChange={(e) => setConfig((c) => (c ? { ...c, featuredLobbyId: e.target.value } : c))}
          style={{ ...S.input, width: 200, cursor: "pointer" }}
        >
          <option value="">None (auto-fallback)</option>
          {lobbies.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name || l.id}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Registration Open">
        <Toggle on={config.registrationOpen} onClick={() => toggle("registrationOpen")} />
      </Row>
      <Row label="Maintenance Mode">
        <Toggle on={config.maintenanceMode} onClick={() => toggle("maintenanceMode")} />
      </Row>
      <Row label="Operator AI Enabled">
        <Toggle on={config.aiEnabled} onClick={() => toggle("aiEnabled")} />
      </Row>
      <Row label="Chat Rate Limit (msg/min)">
        <input
          type="number"
          style={{ ...S.input, width: 80 }}
          value={config.chatRateLimit}
          onChange={(e) => num("chatRateLimit", e.target.value)}
        />
      </Row>
      <Row label="Max Rooms per Lobby">
        <input
          type="number"
          style={{ ...S.input, width: 80 }}
          value={config.maxRoomsPerLobby}
          onChange={(e) => num("maxRoomsPerLobby", e.target.value)}
        />
      </Row>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
        <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Config"}
        </button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>
    </div>
  );
}
