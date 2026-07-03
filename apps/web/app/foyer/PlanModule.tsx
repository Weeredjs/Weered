"use client";
// In-room Fathom plan module. HOST side: pull a client's plan of record via the
// same-origin host-gated proxy (/api/office/plan/*), adjust the renewal levers,
// apply to the plan of record, send the amendment to the carrier, and PRESENT the
// plan to the room. CLIENT side: PresentedPlanViewer polls the presented snapshot
// (guest-readable by design) and renders it read-only. The engine token is minted
// server-side; it never reaches the browser.
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

const API = "/api";

function fmtPlanValue(type: string | undefined, v: any): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (type === "ratio" && typeof v === "number") return `${Math.round(v * 100)}%`;
  if (type === "money" && typeof v === "number") return `$${v.toLocaleString()}`;
  return String(v);
}

// Read-only rendering of an employer + plan snapshot (shared by host + client).
function PlanBody({ detail, accent }: { detail: any; accent: string }) {
  return (
    <>
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
          No plan of record on file yet.
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          {Object.entries(detail.plan.benefitDesign || {}).map(([benefit, obj]: [string, any]) => (
            <div key={benefit} style={PM.benefit}>
              <div style={{ ...PM.benefitHead, color: accent }}>{benefit}</div>
              {obj && typeof obj === "object" ? (
                Object.entries(obj).map(([field, val]: [string, any]) => {
                  const fs = detail.fields?.[benefit]?.[field];
                  return (
                    <div key={field} style={PM.row}>
                      <span style={{ color: "#c9d4e0" }}>{fs?.label || field}</span>
                      <span style={{ fontWeight: 700 }}>{fmtPlanValue(fs?.type, val)}</span>
                    </div>
                  );
                })
              ) : (
                <div style={PM.row}>
                  <span style={{ color: "#c9d4e0" }}>Coverage</span>
                  <span style={{ fontWeight: 700 }}>{String(obj)}</span>
                </div>
              )}
            </div>
          ))}
          <div style={PM.ver}>Plan of record · v{detail.plan.version}</div>
        </div>
      )}
    </>
  );
}

// CLIENT side: renders whatever the host is presenting, live. Polls while mounted.
export function PresentedPlanViewer({
  getToken,
  accent,
}: {
  getToken: () => string;
  accent: string;
}) {
  const [data, setData] = useState<any | null>(null);
  const seqRef = useRef(0);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`${API}/office/plan/presented`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const j = await r.json();
        if (stop || !j?.ok) return;
        if (!j.data) {
          seqRef.current = 0;
          setData(null);
        } else if (j.seq !== seqRef.current) {
          seqRef.current = j.seq;
          setData(j.data);
        }
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 3000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!data) return null;
  return (
    <div style={{ ...PM.panel, borderColor: accent }}>
      <div style={PM.head}>
        <strong style={{ color: accent }}>◧ Your plan — live review</strong>
        <span style={{ color: "#8b949e", fontSize: 12 }}>shared by your advisor</span>
      </div>
      <div style={{ padding: 12 }}>
        <PlanBody detail={data} accent={accent} />
      </div>
    </div>
  );
}

export function PlanModule({ jwt, accent }: { jwt: string; accent: string }) {
  const [open, setOpen] = useState(false);
  const [book, setBook] = useState<"eceb" | "demo">("eceb");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // edit state
  const [editing, setEditing] = useState(false);
  const [changes, setChanges] = useState<any[]>([]);
  const [selBenefit, setSelBenefit] = useState("");
  const [selField, setSelField] = useState("");
  const [selVal, setSelVal] = useState("");
  const [busy, setBusy] = useState("");
  const [flash, setFlash] = useState("");
  const [showSend, setShowSend] = useState(false);
  const [carrierEmail, setCarrierEmail] = useState("");
  const [effDate, setEffDate] = useState("");
  const [presenting, setPresenting] = useState(false);

  const authHdr = { Authorization: `Bearer ${jwt}` };

  const postPresent = useCallback(
    async (data: any) => {
      try {
        await fetch(`${API}/office/plan/present`, {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
      } catch {}
    },
    [jwt],
  );

  const runSearch = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const r = await fetch(
        `${API}/office/plan/employers?book=${book}&q=${encodeURIComponent(q)}`,
        { headers: authHdr },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "lookup failed");
      setResults(j.employers || []);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, jwt, book]);

  const loadEmployer = useCallback(
    async (id: string): Promise<any | null> => {
      setErr("");
      setLoading(true);
      setEditing(false);
      setChanges([]);
      setShowSend(false);
      setFlash("");
      try {
        const r = await fetch(
          `${API}/office/plan/employer/${encodeURIComponent(id)}?book=${book}`,
          { headers: authHdr },
        );
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "load failed");
        setDetail(j);
        return j;
      } catch (e: any) {
        setErr(String(e?.message || e));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [jwt, book],
  );

  const stopPresenting = () => {
    if (presenting) {
      void postPresent(null);
      setPresenting(false);
    }
  };

  const pickBook = (b: "eceb" | "demo") => {
    stopPresenting();
    setBook(b);
    setResults([]);
    setDetail(null);
    setErr("");
  };

  const togglePresent = async () => {
    if (!detail) return;
    if (presenting) {
      await postPresent(null);
      setPresenting(false);
    } else {
      await postPresent(detail);
      setPresenting(true);
    }
  };

  const curOf = (benefit: string, field: string) => {
    const g = detail?.plan?.benefitDesign?.[benefit];
    const v = g && typeof g === "object" ? g[field] : undefined;
    return typeof v === "number" || typeof v === "boolean" ? v : null;
  };

  const spec = () => detail?.fields?.[selBenefit]?.[selField];

  const addChange = () => {
    const sp = spec();
    if (!selBenefit || !selField || !sp) return;
    let to: number | boolean;
    if (sp.type === "boolean") to = selVal === "true";
    else if (sp.type === "ratio") to = Number(selVal) / 100;
    else to = Number(selVal);
    if (sp.type !== "boolean" && !Number.isFinite(to as number)) return;
    const label = `${sp.label}: ${fmtPlanValue(sp.type, to)}`;
    setChanges((c) => [
      ...c.filter((x) => !(x.benefit === selBenefit && x.field === selField)),
      { benefit: selBenefit, field: selField, from: curOf(selBenefit, selField), to, label },
    ]);
    setSelVal("");
    setFlash("");
  };

  const payloadChanges = () =>
    changes.map(({ benefit, field, from, to }) => ({ benefit, field, from, to }));

  const apply = async () => {
    if (!changes.length || !detail) return;
    setBusy("apply");
    setFlash("");
    try {
      const r = await fetch(
        `${API}/office/plan/employer/${encodeURIComponent(detail.employer.id)}?book=${book}`,
        {
          method: "PATCH",
          headers: { ...authHdr, "Content-Type": "application/json" },
          body: JSON.stringify({ changes: payloadChanges(), note: "Adjusted in office review" }),
        },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "apply failed");
      setChanges([]);
      const fresh = await loadEmployer(detail.employer.id);
      if (presenting && fresh) await postPresent(fresh); // client sees the new version live
      setFlash(`Applied to plan of record (now v${j.version}).`);
    } catch (e: any) {
      setFlash("Error: " + String(e?.message || e));
    } finally {
      setBusy("");
    }
  };

  const send = async () => {
    if (!changes.length || !carrierEmail || !effDate || !detail?.plan) return;
    setBusy("send");
    setFlash("");
    try {
      const r = await fetch(`${API}/office/plan/amend?book=${book}`, {
        method: "POST",
        headers: { ...authHdr, "Content-Type": "application/json" },
        body: JSON.stringify({
          employerId: detail.employer.id,
          planId: detail.plan.planId,
          version: detail.plan.version,
          changes: payloadChanges(),
          carrierEmail,
          effectiveDate: effDate,
          note: "Sent from office review",
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.error || "send failed");
      setFlash(`Amendment sent to ${carrierEmail}.`);
      setShowSend(false);
    } catch (e: any) {
      setFlash("Error: " + String(e?.message || e));
    } finally {
      setBusy("");
    }
  };

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

  const benefits = detail?.fields ? Object.keys(detail.fields) : [];
  const fields =
    selBenefit && detail?.fields?.[selBenefit] ? Object.keys(detail.fields[selBenefit]) : [];
  const sp = spec();

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
          <div style={PM.books}>
            <button
              style={{
                ...PM.bookBtn,
                ...(book === "eceb" ? { background: accent, color: "#08120b" } : {}),
              }}
              onClick={() => pickBook("eceb")}
            >
              ECEB book
            </button>
            <button
              style={{
                ...PM.bookBtn,
                ...(book === "demo" ? { background: accent, color: "#08120b" } : {}),
              }}
              onClick={() => pickBook("demo")}
            >
              Demo book
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...PM.input, flex: 1, width: undefined }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search clients by name…"
              autoFocus
            />
            <button style={{ ...PM.go, background: accent }} onClick={runSearch}>
              {loading ? "…" : "Search"}
            </button>
          </div>
          {err && <div style={PM.err}>{err}</div>}
          <div style={{ marginTop: 10 }}>
            {results.map((e) => (
              <button key={e.id} style={PM.result} onClick={() => loadEmployer(e.id)}>
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
          <button
            style={PM.back}
            onClick={() => {
              stopPresenting();
              setDetail(null);
            }}
          >
            ‹ Change client
          </button>
          <PlanBody detail={detail} accent={accent} />

          {detail.plan && (
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                style={{
                  ...PM.adjust,
                  marginTop: 0,
                  borderColor: accent,
                  color: editing ? "#08120b" : accent,
                  background: editing ? accent : "transparent",
                }}
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? "Done adjusting" : "✎ Adjust plan"}
              </button>
              <button
                style={{
                  ...PM.adjust,
                  marginTop: 0,
                  borderColor: presenting ? "#3fb950" : "#8b949e",
                  color: presenting ? "#08120b" : "#c9d4e0",
                  background: presenting ? "#3fb950" : "transparent",
                }}
                onClick={togglePresent}
              >
                {presenting ? "■ Stop presenting" : "▶ Present to room"}
              </button>
            </div>
          )}

          {editing && detail.plan && (
            <div style={PM.editor}>
              <div style={PM.editRow}>
                <select
                  style={PM.sel}
                  value={selBenefit}
                  onChange={(e) => {
                    setSelBenefit(e.target.value);
                    setSelField("");
                    setSelVal("");
                  }}
                >
                  <option value="">benefit…</option>
                  {benefits.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <select
                  style={PM.sel}
                  value={selField}
                  onChange={(e) => {
                    setSelField(e.target.value);
                    setSelVal("");
                  }}
                  disabled={!selBenefit}
                >
                  <option value="">lever…</option>
                  {fields.map((f) => (
                    <option key={f} value={f}>
                      {detail.fields[selBenefit][f].label}
                    </option>
                  ))}
                </select>
              </div>
              {sp && (
                <div style={PM.editRow}>
                  {sp.type === "boolean" ? (
                    <select
                      style={PM.sel}
                      value={selVal}
                      onChange={(e) => setSelVal(e.target.value)}
                    >
                      <option value="">…</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  ) : sp.type === "enum" ? (
                    <select
                      style={PM.sel}
                      value={selVal}
                      onChange={(e) => setSelVal(e.target.value)}
                    >
                      <option value="">…</option>
                      {sp.values.map((v: number) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      style={PM.sel}
                      type="number"
                      value={selVal}
                      onChange={(e) => setSelVal(e.target.value)}
                      placeholder={sp.type === "ratio" ? "percent, e.g. 80" : "amount ($)"}
                    />
                  )}
                  <button
                    style={{ ...PM.go, background: accent }}
                    onClick={addChange}
                    disabled={selVal === ""}
                  >
                    Add
                  </button>
                </div>
              )}
              {sp && curOf(selBenefit, selField) != null && (
                <div style={{ color: "#6a7681", fontSize: 11.5, marginTop: 2 }}>
                  current: {fmtPlanValue(sp.type, curOf(selBenefit, selField))}
                </div>
              )}

              {changes.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  {changes.map((c, i) => (
                    <div key={i} style={PM.chg}>
                      <span>{c.label}</span>
                      <button
                        style={PM.rm}
                        onClick={() => setChanges((x) => x.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button
                      style={{ ...PM.apply, background: accent }}
                      onClick={apply}
                      disabled={busy !== ""}
                    >
                      {busy === "apply" ? "Applying…" : "Apply to plan of record"}
                    </button>
                    <button
                      style={PM.sendBtn}
                      onClick={() => setShowSend((v) => !v)}
                      disabled={busy !== ""}
                    >
                      Send to carrier →
                    </button>
                  </div>
                </div>
              )}

              {showSend && changes.length > 0 && (
                <div style={PM.sendForm}>
                  <div style={{ color: "#e0b341", fontSize: 12, marginBottom: 6 }}>
                    This emails the carrier a plan-amendment notice.
                  </div>
                  <input
                    style={PM.input}
                    value={carrierEmail}
                    onChange={(e) => setCarrierEmail(e.target.value)}
                    placeholder="carrier email"
                    autoComplete="off"
                  />
                  <input
                    style={{ ...PM.input, marginTop: 6 }}
                    type="date"
                    value={effDate}
                    onChange={(e) => setEffDate(e.target.value)}
                  />
                  <button
                    style={{ ...PM.apply, background: "#c9781a", marginTop: 8, width: "100%" }}
                    onClick={send}
                    disabled={busy !== "" || !carrierEmail || !effDate}
                  >
                    {busy === "send" ? "Sending…" : "Confirm + send amendment"}
                  </button>
                </div>
              )}
            </div>
          )}

          {flash && (
            <div style={{ ...PM.flash, color: flash.startsWith("Error") ? "#f85149" : "#3fb950" }}>
              {flash}
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
  books: { display: "flex", gap: 6, marginBottom: 10 },
  bookBtn: {
    flex: 1,
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid #283040",
    background: "#0d1117",
    color: "#c9d4e0",
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
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
  adjust: {
    flex: 1,
    marginTop: 14,
    padding: "10px",
    borderRadius: 9,
    border: "1px solid",
    fontWeight: 800,
    fontSize: 13.5,
    cursor: "pointer",
    background: "transparent",
  },
  editor: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    background: "#0d1117",
    border: "1px solid #283040",
  },
  editRow: { display: "flex", gap: 8, marginBottom: 8 },
  sel: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #283040",
    background: "#11151c",
    color: "#e6edf3",
    fontSize: 13,
  },
  chg: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
    padding: "6px 8px",
    background: "#11151c",
    borderRadius: 7,
    marginTop: 5,
  },
  rm: { border: 0, background: "transparent", color: "#8b949e", cursor: "pointer", fontSize: 13 },
  apply: {
    border: 0,
    borderRadius: 8,
    color: "#08120b",
    fontWeight: 800,
    padding: "10px 12px",
    cursor: "pointer",
    fontSize: 13,
  },
  sendBtn: {
    border: "1px solid #c9781a",
    background: "transparent",
    color: "#e0a441",
    borderRadius: 8,
    fontWeight: 800,
    padding: "10px 12px",
    cursor: "pointer",
    fontSize: 13,
  },
  sendForm: {
    marginTop: 10,
    padding: 10,
    borderRadius: 9,
    background: "#1a130a",
    border: "1px solid #4a3612",
  },
  flash: { fontSize: 13, marginTop: 10, fontWeight: 600 },
};
