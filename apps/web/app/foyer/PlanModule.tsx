"use client";
// In-room Fathom plan module (host side). Reads a client's plan of record from
// the engine through the same-origin, host-gated API proxy (/api/office/plan/*)
// and renders it live. The engine token is minted server-side; it never reaches
// the browser.
import { useCallback, useState } from "react";
import type { CSSProperties } from "react";

const API = "/api";

function fmtPlanValue(type: string | undefined, v: any): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (type === "ratio" && typeof v === "number") return `${Math.round(v * 100)}%`;
  if (type === "money" && typeof v === "number") return `$${v.toLocaleString()}`;
  return String(v);
}

export function PlanModule({ jwt, accent }: { jwt: string; accent: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const runSearch = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const r = await fetch(`${API}/office/plan/employers?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "lookup failed");
      setResults(j.employers || []);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [q, jwt]);

  const openEmployer = useCallback(
    async (id: string) => {
      setErr("");
      setLoading(true);
      try {
        const r = await fetch(`${API}/office/plan/employer/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "load failed");
        setDetail(j);
      } catch (e: any) {
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    },
    [jwt],
  );

  if (!open) {
    return (
      <div style={PM.barWrap}>
        <button style={{ ...PM.bar, borderColor: accent }} onClick={() => setOpen(true)}>
          <span style={{ color: accent, fontWeight: 800 }}>◧ Client plan</span>
          <span style={{ color: "#8b949e", fontSize: 13 }}>
            Pull up a client&apos;s plan of record
          </span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ ...PM.panel, borderColor: accent }}>
      <div style={PM.head}>
        <strong style={{ color: accent }}>◧ Client plan</strong>
        <button style={PM.x} onClick={() => setOpen(false)}>
          Hide
        </button>
      </div>

      {!detail ? (
        <div style={{ padding: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={PM.input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search your clients by name…"
              autoFocus
            />
            <button style={{ ...PM.go, background: accent }} onClick={runSearch}>
              {loading ? "…" : "Search"}
            </button>
          </div>
          {err && <div style={PM.err}>{err}</div>}
          <div style={{ marginTop: 10 }}>
            {results.map((e) => (
              <button key={e.id} style={PM.result} onClick={() => openEmployer(e.id)}>
                <span style={{ fontWeight: 700 }}>{e.name}</span>
                <span style={{ color: "#8b949e", fontSize: 12 }}>
                  {[e.carrier, e.renewalMonth, e.lives ? `${e.lives} lives` : null]
                    .filter(Boolean)
                    .join(" · ") || e.status}
                </span>
              </button>
            ))}
            {!loading && results.length === 0 && q && !err && (
              <div style={{ color: "#8b949e", fontSize: 13, padding: "8px 2px" }}>No matches.</div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: 12 }}>
          <button style={PM.back} onClick={() => setDetail(null)}>
            ‹ Change client
          </button>
          <div style={PM.clientName}>{detail.employer?.name}</div>
          <div style={PM.meta}>
            {[
              detail.employer?.carrier
                ? `${detail.employer.carrier}${detail.employer.carrierPolicy ? ` #${detail.employer.carrierPolicy}` : ""}`
                : null,
              detail.employer?.renewalMonth ? `Renews ${detail.employer.renewalMonth}` : null,
              detail.employer?.lives ? `${detail.employer.lives} lives` : null,
              detail.employer?.premium || null,
            ]
              .filter(Boolean)
              .join("  ·  ") || "No carrier on file yet"}
          </div>

          {!detail.plan ? (
            <div style={{ color: "#8b949e", fontSize: 13, marginTop: 12 }}>
              No plan of record on file for this client yet.
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              {Object.entries(detail.plan.benefitDesign || {}).map(
                ([benefit, obj]: [string, any]) => (
                  <div key={benefit} style={PM.benefit}>
                    <div style={{ ...PM.benefitHead, color: accent }}>{benefit}</div>
                    {Object.entries(obj || {}).map(([field, val]: [string, any]) => {
                      const spec = detail.fields?.[benefit]?.[field];
                      return (
                        <div key={field} style={PM.row}>
                          <span style={{ color: "#c9d4e0" }}>{spec?.label || field}</span>
                          <span style={{ fontWeight: 700 }}>{fmtPlanValue(spec?.type, val)}</span>
                        </div>
                      );
                    })}
                  </div>
                ),
              )}
              <div style={PM.ver}>Plan of record · v{detail.plan.version}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PM: Record<string, CSSProperties> = {
  barWrap: { marginBottom: 12 },
  bar: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "11px 14px",
    borderRadius: 10,
    border: "1px solid",
    background: "#11151c",
    color: "#e6edf3",
    cursor: "pointer",
  },
  panel: {
    marginBottom: 12,
    border: "1px solid",
    borderRadius: 12,
    background: "#11151c",
    overflow: "hidden",
  },
  head: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 14px",
    borderBottom: "1px solid #283040",
  },
  x: {
    border: "1px solid #283040",
    background: "#21262d",
    color: "#fff",
    borderRadius: 8,
    padding: "4px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
  input: {
    flex: 1,
    padding: "9px 11px",
    borderRadius: 8,
    border: "1px solid #283040",
    background: "#0d1117",
    color: "#e6edf3",
    fontSize: 14,
  },
  go: {
    border: 0,
    borderRadius: 8,
    color: "#08120b",
    fontWeight: 800,
    padding: "9px 16px",
    cursor: "pointer",
  },
  err: { color: "#f85149", fontSize: 13, marginTop: 8 },
  result: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    padding: "9px 11px",
    marginTop: 6,
    borderRadius: 8,
    border: "1px solid #283040",
    background: "#0d1117",
    color: "#e6edf3",
    cursor: "pointer",
    textAlign: "left",
  },
  back: {
    border: 0,
    background: "transparent",
    color: "#8b949e",
    cursor: "pointer",
    fontSize: 13,
    padding: "0 0 8px",
  },
  clientName: { fontSize: 18, fontWeight: 800 },
  meta: { color: "#8b949e", fontSize: 13, marginTop: 3 },
  benefit: { marginTop: 12 },
  benefitHead: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: ".5px",
    fontWeight: 800,
    marginBottom: 4,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 14,
    padding: "5px 0",
    borderTop: "1px solid #1b2029",
  },
  ver: { color: "#6a7681", fontSize: 11, marginTop: 12, textAlign: "right" },
};
