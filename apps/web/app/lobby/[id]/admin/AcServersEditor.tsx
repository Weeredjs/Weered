"use client";
import React, { useState } from "react";
import { LobbyData, S, apiFetch } from "./shared";

type Row = { label: string; host: string; httpPort: string };
type Rejected = { index: number; host: string; reason: string };

const MAX_SERVERS = 12;

function rowsFrom(moduleConfig: any): Row[] {
  const raw = Array.isArray(moduleConfig?.acServers) ? moduleConfig.acServers : [];
  return raw.map((s: any) => ({
    label: typeof s?.label === "string" ? s.label : "",
    host: typeof s?.host === "string" ? s.host : "",
    httpPort: s?.httpPort != null ? String(s.httpPort) : "",
  }));
}

/**
 * Lets a lobby owner point the Assetto Corsa board at their own servers.
 *
 * Without this the list is only settable in seed data, which would mean every
 * racing community needs us to ship a release before their board works.
 */
export function AcServersEditor({ lobby, onRefresh }: { lobby: LobbyData; onRefresh: () => void }) {
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(lobby.moduleConfig));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [rejected, setRejected] = useState<Rejected[]>([]);

  React.useEffect(() => {
    setRows(rowsFrom(lobby.moduleConfig));
  }, [lobby.moduleConfig]);

  function set(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { label: "", host: "", httpPort: "" }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, n) => n !== i));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    setRejected([]);
    const payload = rows
      .filter((r) => r.host.trim() || r.httpPort.trim())
      .map((r) => ({
        label: r.label.trim(),
        host: r.host.trim(),
        httpPort: Number(r.httpPort),
      }));
    const j = await apiFetch(`/assetto/${encodeURIComponent(lobby.id)}/servers`, {
      method: "PATCH",
      body: JSON.stringify({ servers: payload }),
    });
    setSaving(false);
    if (!j?.ok) {
      setMsg(j?.error || "Failed.");
      return;
    }
    const bad: Rejected[] = Array.isArray(j.rejected) ? j.rejected : [];
    setRejected(bad);
    const kept = Array.isArray(j.servers) ? j.servers.length : 0;
    setMsg(
      bad.length
        ? `Saved ${kept} server${kept === 1 ? "" : "s"}. ${bad.length} not saved — see below.`
        : `Saved ${kept} server${kept === 1 ? "" : "s"}.`,
    );
    onRefresh();
  }

  return (
    <div style={{ marginTop: 22 }}>
      <div style={S.sectionTitle}>Assetto Corsa · Server Board</div>
      <div
        style={{ fontSize: 11, opacity: 0.55, marginTop: -4, marginBottom: 12, lineHeight: 1.5 }}
      >
        Servers listed here appear on the lobby&apos;s board with their circuit, session, grid and
        who is on track. Use the server&apos;s <strong>HTTP port</strong> — the one in the address
        Content Manager shows, which is usually not the game port. Nothing is installed on the
        server; the board reads the public endpoint the in-game browser already uses.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r, i) => {
          const bad = rejected.find((x) => x.index === i);
          return (
            <div key={i} style={{ ...S.card, borderColor: bad ? "rgba(239,68,68,.4)" : undefined }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <label style={{ flex: "2 1 150px" }}>
                  <div style={S.label}>Name</div>
                  <input
                    style={{ ...S.input, width: "100%" }}
                    value={r.label}
                    maxLength={60}
                    placeholder="GT3 · No DLC"
                    onChange={(e) => set(i, { label: e.target.value })}
                  />
                </label>
                <label style={{ flex: "3 1 180px" }}>
                  <div style={S.label}>Address</div>
                  <input
                    style={{ ...S.input, width: "100%" }}
                    value={r.host}
                    placeholder="race.example.com"
                    onChange={(e) => set(i, { host: e.target.value })}
                  />
                </label>
                <label style={{ flex: "0 1 110px" }}>
                  <div style={S.label}>HTTP port</div>
                  <input
                    style={{ ...S.input, width: "100%" }}
                    value={r.httpPort}
                    inputMode="numeric"
                    placeholder="8081"
                    onChange={(e) => set(i, { httpPort: e.target.value.replace(/[^0-9]/g, "") })}
                  />
                </label>
                <button
                  style={{ ...S.btn, ...S.danger, padding: "7px 12px" }}
                  onClick={() => removeRow(i)}
                  aria-label={`Remove ${r.label || r.host || "server"}`}
                >
                  Remove
                </button>
              </div>
              {bad && (
                <div style={{ fontSize: 11, color: "rgb(252,165,165)", marginTop: 8 }}>
                  {bad.reason}
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <div style={{ ...S.card, fontSize: 12, opacity: 0.6 }}>
            No servers yet. Add one and the board goes live.
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
        <button
          style={{ ...S.btn, padding: "8px 16px" }}
          onClick={addRow}
          disabled={rows.length >= MAX_SERVERS}
        >
          Add server
        </button>
        <button style={{ ...S.btnPri, padding: "8px 20px" }} onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Servers"}
        </button>
        {msg && <span style={{ fontSize: 12, opacity: 0.75 }}>{msg}</span>}
      </div>
      {rows.length >= MAX_SERVERS && (
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 6 }}>
          {MAX_SERVERS}-server maximum reached.
        </div>
      )}
    </div>
  );
}
