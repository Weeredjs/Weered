"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "../../../../../lib/api";
import { weeredToast } from "../../../../../lib/toast";
import { weeredConfirm } from "../../../../../lib/confirm";

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "REGEX_FILTER", label: "Regex filter", hint: "Trigger when content matches a regex." },
  { id: "WORD_BLOCK", label: "Word block", hint: "Trigger on substring match (case-insensitive)." },
  { id: "LINK_BLOCK", label: "Link block", hint: "Trigger when URL host isn't in the allowlist." },
  { id: "KARMA_MIN", label: "Min lobby karma", hint: "Trigger when author karma is below threshold." },
  { id: "ACCOUNT_AGE_MIN", label: "Min account age", hint: "Trigger when author account is too new." },
];
const ACTIONS: { id: Action; label: string; hint: string }[] = [
  { id: "REPORT", label: "Report", hint: "File a mod-queue report; content stays live." },
  { id: "REMOVE", label: "Block", hint: "Reject the post entirely with an error." },
  { id: "SHADOW_REMOVE", label: "Shadow remove", hint: "Author sees it; nobody else does." },
  { id: "REQUIRE_REVIEW", label: "Require review", hint: "Flag for mod-queue review; content stays live." },
];
type Kind = "REGEX_FILTER" | "WORD_BLOCK" | "LINK_BLOCK" | "KARMA_MIN" | "ACCOUNT_AGE_MIN";
type Action = "REPORT" | "REMOVE" | "SHADOW_REMOVE" | "REQUIRE_REVIEW";

type Rule = {
  id: string; lobbyId: string; name: string; kind: Kind;
  config: any; action: Action; enabled: boolean;
  createdById: string; createdAt: string; updatedAt: string;
};

export default function AutoModAdminPage() {
  const router = useRouter();
  const params = useParams() as any;
  const lobbyId = String(params?.id || "");

  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setForbidden(false);
    const data = await apiFetch(`/forum/automod?lobbyId=${encodeURIComponent(lobbyId)}`, { silent: true });
    if (data?.ok) setRules(data.rules || []);
    else if (data?.error === "forbidden") setForbidden(true);
    setLoading(false);
  }, [lobbyId]);

  useEffect(() => { if (lobbyId) load(); }, [lobbyId, load]);

  async function toggleEnabled(rule: Rule) {
    const data = await apiFetch(`/forum/automod/${rule.id}`, {
      method: "PATCH", body: JSON.stringify({ enabled: !rule.enabled }),
    });
    if (data?.ok) load();
  }

  async function deleteRule(rule: Rule) {
    const ok = await weeredConfirm({ title: `Delete rule "${rule.name}"?`, body: "Existing reports stay; future content won't be checked.", confirmLabel: "Delete", destructive: true });
    if (!ok) return;
    const data = await apiFetch(`/forum/automod/${rule.id}`, { method: "DELETE" });
    if (data?.ok) { weeredToast.success("Rule deleted"); load(); }
  }

  if (forbidden) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px", fontFamily: FONT, color: "rgba(243,244,246,.85)" }}>
        <h1 style={{ fontSize: 18, fontWeight: 800 }}>Owner access required</h1>
        <div style={{ fontSize: 13, opacity: 0.6, marginTop: 6 }}>Only lobby owners or staff can configure auto-mod.</div>
        <button onClick={() => router.push(`/lobby/${lobbyId}`)} style={btnStyle()}>&larr; Back to lobby</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "20px 16px 60px", fontFamily: FONT, color: "rgba(243,244,246,.92)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, letterSpacing: "-0.3px" }}>Auto-Mod Rules</h1>
          <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2 }}>Automatic moderation for posts and comments in this lobby.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push(`/lobby/${lobbyId}/admin`)} style={btnStyle()}>&larr; Admin</button>
          <button onClick={() => setCreating(true)} style={btnStyle("primary")}>+ Add Rule</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2].map(i => <div key={i} style={{ height: 72, borderRadius: 10, background: "rgba(255,255,255,.03)" }} />)}
        </div>
      ) : rules.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(148,163,184,.55)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(243,244,246,.7)" }}>No rules yet.</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Add one to start filtering content automatically.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rules.map(rule => (
            <div key={rule.id} style={{
              padding: "12px 14px", borderRadius: 10,
              background: "rgba(255,255,255,.025)",
              border: `1px solid ${rule.enabled ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.06)"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={rule.enabled} onChange={() => toggleEnabled(rule)} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{rule.name}</span>
                </label>
                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.6)" }}>{rule.kind}</span>
                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: "rgba(124,58,237,.14)", color: "#c4b5fd" }}>{rule.action}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button onClick={() => setEditing(rule)} style={btnStyle()}>Edit</button>
                  <button onClick={() => deleteRule(rule)} style={btnStyle("danger")}>Delete</button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "rgba(148,163,184,.65)", marginTop: 6, fontFamily: "ui-monospace, monospace" }}>
                {summarizeConfig(rule.kind, rule.config)}
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <RuleEditor
          lobbyId={lobbyId}
          rule={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function summarizeConfig(kind: Kind, config: any): string {
  if (!config) return "(empty)";
  if (kind === "REGEX_FILTER") return `pattern: /${config.pattern}/${config.flags || ""}`;
  if (kind === "WORD_BLOCK") return `words: ${(config.words || []).join(", ")}`;
  if (kind === "LINK_BLOCK") return `allowed: ${(config.allowedDomains || []).join(", ") || "(none)"}`;
  if (kind === "KARMA_MIN") return `min: ${config.min}`;
  if (kind === "ACCOUNT_AGE_MIN") return `minDays: ${config.minDays}`;
  return JSON.stringify(config);
}

function RuleEditor({ lobbyId, rule, onClose, onSaved }: { lobbyId: string; rule: Rule | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(rule?.name || "");
  const [kind, setKind] = useState<Kind>(rule?.kind || "WORD_BLOCK");
  const [action, setAction] = useState<Action>(rule?.action || "REPORT");
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [config, setConfig] = useState<any>(rule?.config || defaultConfig("WORD_BLOCK"));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!rule) setConfig(defaultConfig(kind));
  }, [kind, rule]);

  async function save() {
    if (!name.trim()) { weeredToast.error("Name required"); return; }
    setSubmitting(true);
    const cfg = serializeConfig(kind, config);
    const path = rule ? `/forum/automod/${rule.id}` : `/forum/automod`;
    const method = rule ? "PATCH" : "POST";
    const body = rule
      ? { name: name.trim(), kind, action, enabled, config: cfg }
      : { lobbyId, name: name.trim(), kind, action, enabled, config: cfg };
    const data = await apiFetch(path, { method, body: JSON.stringify(body) });
    setSubmitting(false);
    if (data?.ok) { weeredToast.success(rule ? "Rule updated" : "Rule created"); onSaved(); }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 10002, padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 540,
        background: "rgba(20,18,16,0.96)",
        border: "1px solid rgba(148,163,184,0.28)",
        borderRadius: 14, padding: "22px",
        color: "rgba(243,244,246,.95)", fontFamily: FONT,
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 14px" }}>{rule ? "Edit rule" : "Add rule"}</h2>

        <Field label="Name">
          <input value={name} onChange={e => setName(e.target.value)} maxLength={100} style={inputStyle} placeholder="e.g. block crypto spam" />
        </Field>

        <Field label="Kind">
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {KINDS.map(k => (
              <button key={k.id} onClick={() => setKind(k.id)} style={chipStyle(kind === k.id)} title={k.hint}>{k.label}</button>
            ))}
          </div>
        </Field>

        <Field label="Config">
          <ConfigForm kind={kind} value={config} onChange={setConfig} />
        </Field>

        <Field label="Action">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {ACTIONS.map(a => (
              <button key={a.id} onClick={() => setAction(a.id)} style={{
                ...chipStyle(action === a.id),
                display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", padding: "8px 12px",
              }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{a.label}</span>
                <span style={{ fontSize: 11, color: "rgba(148,163,184,.7)" }}>{a.hint}</span>
              </button>
            ))}
          </div>
        </Field>

        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 4, cursor: "pointer" }}>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
          <span style={{ fontSize: 12 }}>Enabled</span>
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={onClose} disabled={submitting} style={btnStyle()}>Cancel</button>
          <button onClick={save} disabled={submitting} style={btnStyle("primary")}>{submitting ? "Saving..." : rule ? "Save" : "Create"}</button>
        </div>
      </div>
    </div>
  );
}

function defaultConfig(kind: Kind): any {
  if (kind === "REGEX_FILTER") return { pattern: "", flags: "i" };
  if (kind === "WORD_BLOCK") return { words: [] };
  if (kind === "LINK_BLOCK") return { allowedDomains: [] };
  if (kind === "KARMA_MIN") return { min: 10 };
  if (kind === "ACCOUNT_AGE_MIN") return { minDays: 7 };
  return {};
}
function serializeConfig(kind: Kind, config: any): any {
  if (kind === "WORD_BLOCK") return { words: typeof config.words === "string" ? config.words.split(",").map((s: string) => s.trim()).filter(Boolean) : (config.words || []) };
  if (kind === "LINK_BLOCK") return { allowedDomains: typeof config.allowedDomains === "string" ? config.allowedDomains.split(",").map((s: string) => s.trim()).filter(Boolean) : (config.allowedDomains || []) };
  if (kind === "KARMA_MIN") return { min: Number(config.min) };
  if (kind === "ACCOUNT_AGE_MIN") return { minDays: Number(config.minDays) };
  return config;
}

function ConfigForm({ kind, value, onChange }: { kind: Kind; value: any; onChange: (v: any) => void }) {
  if (kind === "REGEX_FILTER") {
    return (
      <>
        <input value={value?.pattern || ""} onChange={e => onChange({ ...value, pattern: e.target.value })} placeholder="Pattern (e.g. (viagra|cialis))" style={inputStyle} />
        <input value={value?.flags || ""} onChange={e => onChange({ ...value, flags: e.target.value })} placeholder="Flags (default: i)" style={{ ...inputStyle, marginTop: 6 }} />
      </>
    );
  }
  if (kind === "WORD_BLOCK") {
    const v = Array.isArray(value?.words) ? value.words.join(", ") : (value?.words || "");
    return <textarea value={v} onChange={e => onChange({ ...value, words: e.target.value })} placeholder="Comma-separated words" rows={3} style={{ ...inputStyle, resize: "vertical" }} />;
  }
  if (kind === "LINK_BLOCK") {
    const v = Array.isArray(value?.allowedDomains) ? value.allowedDomains.join(", ") : (value?.allowedDomains || "");
    return <textarea value={v} onChange={e => onChange({ ...value, allowedDomains: e.target.value })} placeholder="Allowed domains, comma-separated (e.g. youtube.com, twitch.tv)" rows={3} style={{ ...inputStyle, resize: "vertical" }} />;
  }
  if (kind === "KARMA_MIN") {
    return <input type="number" value={value?.min ?? 0} onChange={e => onChange({ ...value, min: e.target.value })} placeholder="Minimum lobby karma" style={inputStyle} />;
  }
  if (kind === "ACCOUNT_AGE_MIN") {
    return <input type="number" value={value?.minDays ?? 0} onChange={e => onChange({ ...value, minDays: e.target.value })} placeholder="Minimum account age (days)" style={inputStyle} />;
  }
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.5, letterSpacing: ".7px", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8,
  border: "1px solid rgba(255,255,255,.1)", background: "rgba(0,0,0,.25)",
  color: "rgba(243,244,246,.95)", fontSize: 13, outline: "none", boxSizing: "border-box",
  fontFamily: "inherit",
};

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px", borderRadius: 6,
    border: active ? "1px solid rgba(124,58,237,.5)" : "1px solid rgba(255,255,255,.08)",
    background: active ? "rgba(124,58,237,.16)" : "transparent",
    color: active ? "#c4b5fd" : "rgba(243,244,246,.85)",
    fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  };
}

function btnStyle(variant?: "primary" | "danger"): React.CSSProperties {
  if (variant === "primary") return {
    padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(124,58,237,.4)",
    background: "rgba(124,58,237,.18)", color: "#c4b5fd",
    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  };
  if (variant === "danger") return {
    padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(239,68,68,.3)",
    background: "rgba(239,68,68,.1)", color: "rgba(252,165,165,.95)",
    fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  };
  return {
    padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.04)", color: "rgba(243,244,246,.85)",
    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
  };
}
