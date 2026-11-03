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
    void Promise.all([apiFetch("/staff/config"), apiFetch("/staff/lobbies")]).then(
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

  // The people the cap turned away who asked to hear when there's room.
  async function copyWaitlist() {
    const j = await apiFetch("/staff/waitlist");
    const list: string[] = (j?.entries || []).map((e: any) => String(e.email));
    try {
      await navigator.clipboard.writeText(list.join("\n"));
      setMsg(`Copied ${list.length} address${list.length === 1 ? "" : "es"}.`);
    } catch {
      setMsg("Couldn't copy.");
    }
  }

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

  // The flood switches act the moment they're pressed: in a flood there's no
  // time for Save (api lib/flood.ts, flood readiness 2026-11-02).
  async function setSwitch(body: Partial<SiteConfig>, done: string) {
    if (
      body.capacityMode === true &&
      !window.confirm(
        'Lights off: everyone but staff gets the "Weered is full" page and drops out of their rooms. Go?',
      )
    )
      return;
    const j = await apiFetch("/staff/config", { method: "POST", body: JSON.stringify(body) });
    if (j?.ok) setConfig((c) => (c ? { ...c, ...body } : c));
    setMsg(j?.ok ? done : j?.error || "Failed.");
  }
  const flood = config.floodMode || "off";

  return (
    <div style={{ maxWidth: 560 }}>
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 9,
          border: "1px solid rgba(251,191,36,.35)",
          background: "rgba(251,191,36,.06)",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>If Weered floods</div>
        <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.5, marginBottom: 10 }}>
          Flood mode: sign-ups wait on the waitlist, the AI builder rests, crowded rooms update
          every few seconds and pages refresh less. It also switches itself on when the server runs
          hot, and off after 15 calm minutes. Lights off: everyone but staff gets a &quot;Weered is
          full&quot; page until you switch it back.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            style={flood === "off" ? S.btn : S.btnPri}
            onClick={() =>
              void setSwitch(
                { floodMode: flood === "off" ? "on" : "off" },
                flood === "off" ? "Flood mode is on." : "Flood mode is off.",
              )
            }
          >
            {flood === "off"
              ? "Flood mode: off"
              : flood === "auto"
                ? "Flood mode: on (by itself)"
                : "Flood mode: on"}
          </button>
          <button
            style={config.capacityMode ? S.btnPri : S.btn}
            onClick={() =>
              void setSwitch(
                { capacityMode: !config.capacityMode },
                config.capacityMode ? "The doors are open again." : "Lights off: Weered is full.",
              )
            }
          >
            {config.capacityMode ? "Lights off: on, open the doors" : "Lights off"}
          </button>
        </div>
      </div>
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
      <Row label="Account cap (0 = none)">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <input
            type="number"
            min={0}
            style={{ ...S.input, width: 90 }}
            value={config.registrationCap}
            onChange={(e) => num("registrationCap", e.target.value)}
          />
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            {config.accounts ?? 0} accounts · {config.waitlist ?? 0} waiting
          </span>
          {(config.waitlist ?? 0) > 0 && (
            <button style={S.btn} onClick={copyWaitlist}>
              Copy waitlist
            </button>
          )}
        </div>
      </Row>
      <Row label="Maintenance Mode">
        <Toggle on={config.maintenanceMode} onClick={() => toggle("maintenanceMode")} />
      </Row>
      <Row label="Operator AI Enabled">
        <Toggle on={config.aiEnabled} onClick={() => toggle("aiEnabled")} />
      </Row>
      {/* "Chat rate limit" and "Max rooms per lobby" were cut 2026-11-02: nothing
          read them (chat is held at 6 messages per 10 seconds and rooms at 500 in
          the code). */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
        <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Config"}
        </button>
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>
    </div>
  );
}
