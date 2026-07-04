"use client";
// In-room Fathom plan module. HOST: pull a client's plan of record via the same-
// origin host-gated proxy (/api/office/plan/*), adjust the renewal levers, apply to
// the plan of record, send the amendment to the carrier, and PRESENT the plan to the
// room. CLIENT: PresentedPlanViewer polls the presented snapshot (guest-readable only
// while admitted) and renders it read-only. The engine token is minted server-side.
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

const API = "/api";

// ---- client-facing label + ordering (a prospect must never see raw keys/jargon) ----
function prettyField(k: string): string {
  return String(k || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}
const BENEFIT_LABELS: Record<string, string> = {
  health: "Health & drug",
  drug: "Prescription drugs",
  dental: "Dental",
  vision: "Vision",
  hsa: "Health spending account",
  life: "Life insurance",
  add: "Accidental death & dismemberment",
  ad_d: "Accidental death & dismemberment",
  std: "Short-term disability",
  ltd: "Long-term disability",
  ci: "Critical illness",
  eap: "Employee assistance program",
};
const benefitLabel = (k: string) => BENEFIT_LABELS[String(k).toLowerCase()] || prettyField(k);
const BENEFIT_ORDER = [
  "health",
  "drug",
  "dental",
  "vision",
  "hsa",
  "life",
  "add",
  "ad_d",
  "std",
  "ltd",
  "ci",
  "eap",
];
const benefitRank = (k: string) => {
  const i = BENEFIT_ORDER.indexOf(String(k).toLowerCase());
  return i === -1 ? 999 : i;
};
function fmtPlanValue(type: string | undefined, v: any): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (type === "ratio" && typeof v === "number") return `${Math.round(v * 100)}%`;
  if (type === "money" && typeof v === "number") return `$${v.toLocaleString()}`;
  return String(v);
}
function scalarCoverage(v: any): string {
  if (v === true) return "Included";
  if (v === false) return "Not included";
  const s = String(v).toLowerCase().trim();
  if (s === "included" || s === "yes") return "Included";
  if (s === "excluded" || s === "not included" || s === "no" || s === "none") return "Not included";
  return String(v);
}

// Read-only rendering of an employer + plan snapshot (shared by host + client).
function PlanBody({ detail, accent }: { detail: any; accent: string }) {
  const benefits = Object.entries(detail.plan?.benefitDesign || {}).sort(
    (a: any, b: any) =>
      benefitRank(a[0]) - benefitRank(b[0]) || String(a[0]).localeCompare(String(b[0])),
  );
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
          {benefits.map(([benefit, obj]: [string, any]) => (
            <div key={benefit} style={PM.benefit}>
              <div style={{ ...PM.benefitHead, color: accent }}>{benefitLabel(benefit)}</div>
              {obj && typeof obj === "object" ? (
                Object.entries(obj).map(([field, val]: [string, any]) => {
                  const fs = detail.fields?.[benefit]?.[field];
                  return (
                    <div key={field} style={PM.row}>
                      <span style={{ color: "#c9d4e0" }}>{fs?.label || prettyField(field)}</span>
                      <span style={{ fontWeight: 700 }}>{fmtPlanValue(fs?.type, val)}</span>
                    </div>
                  );
                })
              ) : (
                <div style={PM.row}>
                  <span style={{ color: "#c9d4e0" }}>Coverage</span>
                  <span style={{ fontWeight: 700 }}>{scalarCoverage(obj)}</span>
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

// ---- Renewal rate card (carrier re-rate, shown to the room; nothing goes back
// to the carrier). Row shape mirrors the engine renewal parser's RateRow. ----
const rcMoney = (n: number) =>
  "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// stored pctChange (percent units) wins; else derive premium-pair, else rate-pair
function rcRowPct(r: any): number | null {
  if (typeof r?.pctChange === "number") return r.pctChange;
  if (
    typeof r?.currentPremium === "number" &&
    typeof r?.renewalPremium === "number" &&
    r.currentPremium !== 0
  )
    return ((r.renewalPremium - r.currentPremium) / Math.abs(r.currentPremium)) * 100;
  if (
    typeof r?.currentRate === "number" &&
    typeof r?.renewalRate === "number" &&
    r.currentRate !== 0
  )
    return ((r.renewalRate - r.currentRate) / Math.abs(r.currentRate)) * 100;
  return null;
}
const rcPctColor = (p: number | null) =>
  p == null ? "#6a7681" : p > 0 ? "#f0883e" : p < 0 ? "#3fb950" : "#8b949e";
const rcPctText = (p: number | null) => (p == null ? "—" : `${p > 0 ? "+" : ""}${p.toFixed(1)}%`);

function RateCardTable({ card, accent, title }: { card: any; accent: string; title: string }) {
  const rows: any[] = Array.isArray(card?.rows) ? card.rows : [];
  if (!rows.length) return null;
  let curSum = 0,
    newSum = 0,
    haveCur = false,
    haveNew = false;
  rows.forEach((r) => {
    if (typeof r.currentPremium === "number") {
      curSum += r.currentPremium;
      haveCur = true;
    }
    if (typeof r.renewalPremium === "number") {
      newSum += r.renewalPremium;
      haveNew = true;
    }
  });
  const totalPct =
    haveCur && haveNew && curSum !== 0 ? ((newSum - curSum) / Math.abs(curSum)) * 100 : null;
  const meta = [
    card.effectiveDate ? `Effective ${card.effectiveDate}` : null,
    card.rateGuaranteeMonths != null ? `${card.rateGuaranteeMonths}-month rate guarantee` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const cell = (prem: any, rate: any) =>
    typeof prem === "number" ? rcMoney(prem) : typeof rate === "number" ? String(rate) : "—";
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ ...PM.benefitHead, color: accent }}>{title}</div>
      {meta && <div style={{ color: "#8b949e", fontSize: 12, marginBottom: 4 }}>{meta}</div>}
      <div style={PM.rcHeadRow}>
        <span style={{ flex: 1.4 }}>Benefit</span>
        <span style={PM.rcNumCol}>Current</span>
        <span style={PM.rcNumCol}>Renewal</span>
        <span style={PM.rcPctCol}>Change</span>
      </div>
      {rows.map((r, i) => {
        const pct = rcRowPct(r);
        return (
          <div key={i} style={{ ...PM.rcRow, ...(i === 0 ? { borderTop: "none" } : {}) }}>
            <span style={{ flex: 1.4 }}>
              <span style={{ color: "#e6edf3" }}>{r.benefit}</span>
              {r.tier ? (
                <span style={{ color: "#8b949e", fontSize: 11.5 }}> · {r.tier}</span>
              ) : null}
            </span>
            <span style={{ ...PM.rcNumCol, color: "#c9d4e0" }}>
              {cell(r.currentPremium, r.currentRate)}
            </span>
            <span style={{ ...PM.rcNumCol, fontWeight: 700 }}>
              {cell(r.renewalPremium, r.renewalRate)}
            </span>
            <span style={{ ...PM.rcPctCol, color: rcPctColor(pct), fontWeight: 700 }}>
              {rcPctText(pct)}
            </span>
          </div>
        );
      })}
      {(haveCur || haveNew) && (
        <div style={{ ...PM.rcRow, borderTop: "1px solid #283040" }}>
          <span style={{ flex: 1.4, fontWeight: 800 }}>Total monthly</span>
          <span style={{ ...PM.rcNumCol, color: "#c9d4e0", fontWeight: 700 }}>
            {haveCur ? rcMoney(curSum) : "—"}
          </span>
          <span style={{ ...PM.rcNumCol, fontWeight: 800 }}>{haveNew ? rcMoney(newSum) : "—"}</span>
          <span style={{ ...PM.rcPctCol, color: rcPctColor(totalPct), fontWeight: 800 }}>
            {rcPctText(totalPct)}
          </span>
        </div>
      )}
      {card.note && <div style={{ color: "#8b949e", fontSize: 12, marginTop: 6 }}>{card.note}</div>}
    </div>
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
  const [justUpdated, setJustUpdated] = useState(false);
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
          const wasShowing = seqRef.current !== 0;
          seqRef.current = j.seq;
          setData(j.data);
          if (wasShowing) {
            setJustUpdated(true);
            setTimeout(() => setJustUpdated(false), 2600);
          }
        }
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 2000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Idle placeholder: the container is always on screen once admitted, so the plan
  // reveal feels intentional instead of popping in from nothing.
  if (!data) {
    return (
      <div style={{ ...PM.panel, borderColor: "#283040" }}>
        <div style={PM.head}>
          <strong style={{ color: accent }}>◧ Your plan — live review</strong>
          <span style={{ color: "#8b949e", fontSize: 12 }}>with your advisor</span>
        </div>
        <div style={{ padding: 16, color: "#8b949e", fontSize: 13.5 }}>
          Your advisor will pull up your plan here when the review begins.
        </div>
      </div>
    );
  }
  return (
    <div style={{ ...PM.panel, borderColor: accent }}>
      <div style={PM.head}>
        <strong style={{ color: accent }}>◧ Your plan — live review</strong>
        <span style={{ color: justUpdated ? "#3fb950" : "#8b949e", fontSize: 12 }}>
          {justUpdated ? "· updated just now" : "shared by your advisor"}
        </span>
      </div>
      <div style={{ padding: 12 }}>
        <PlanBody detail={data} accent={accent} />
        {data.rateCard && (
          <RateCardTable card={data.rateCard} accent={accent} title="Your renewal — rates" />
        )}
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

  // renewal rate card (saved card + editor working copy; numbers kept as strings while editing)
  const emptyRcRow = () => ({
    benefit: "",
    tier: "",
    currentRate: "",
    currentPremium: "",
    renewalRate: "",
    renewalPremium: "",
  });
  const [rateCard, setRateCard] = useState<any | null>(null);
  const [rcOpen, setRcOpen] = useState(false);
  const [rcRows, setRcRows] = useState<any[]>([]);
  const [rcEff, setRcEff] = useState("");
  const [rcGuar, setRcGuar] = useState("");
  const [rcNote, setRcNote] = useState("");

  // mirror `presenting` into a ref so unmount/pagehide cleanup reads the latest value
  const presentingRef = useRef(false);
  useEffect(() => {
    presentingRef.current = presenting;
  }, [presenting]);

  // returns true only on a confirmed server ack
  const postPresent = useCallback(
    async (data: any): Promise<boolean> => {
      try {
        const r = await fetch(`${API}/office/plan/present`, {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
          body: JSON.stringify({ data }),
        });
        const j = await r.json().catch(() => null);
        return !!(r.ok && j && j.ok !== false);
      } catch {
        return false;
      }
    },
    [jwt],
  );

  // Safety net: if the host closes the tab / navigates / the component unmounts
  // (e.g. the consult drops to the error card) while presenting, tell the server to
  // stop so the client is never stranded viewing the plan for up to 4h.
  useEffect(() => {
    const stopShare = () => {
      if (!presentingRef.current) return;
      try {
        fetch(`${API}/office/plan/present`, {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
          body: JSON.stringify({ data: null }),
          keepalive: true,
        }).catch(() => {});
      } catch {}
    };
    window.addEventListener("pagehide", stopShare);
    return () => {
      window.removeEventListener("pagehide", stopShare);
      stopShare();
    };
  }, [jwt]);

  const runSearch = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const r = await fetch(
        `${API}/office/plan/employers?book=${book}&q=${encodeURIComponent(q)}`,
        {
          headers: { Authorization: `Bearer ${jwt}` },
        },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "lookup failed");
      setResults(j.employers || []);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [q, jwt, book]);

  // saved card -> editable working copy (numbers become input strings)
  const cardToRows = (card: any): any[] =>
    Array.isArray(card?.rows)
      ? card.rows.map((r: any) => ({
          benefit: r.benefit ?? "",
          tier: r.tier ?? "",
          currentRate: r.currentRate == null ? "" : String(r.currentRate),
          currentPremium: r.currentPremium == null ? "" : String(r.currentPremium),
          renewalRate: r.renewalRate == null ? "" : String(r.renewalRate),
          renewalPremium: r.renewalPremium == null ? "" : String(r.renewalPremium),
        }))
      : [];

  const loadEmployer = useCallback(
    async (id: string): Promise<any | null> => {
      setErr("");
      setLoading(true);
      setEditing(false);
      setChanges([]);
      setShowSend(false);
      setFlash("");
      setRcOpen(false);
      try {
        const r = await fetch(
          `${API}/office/plan/employer/${encodeURIComponent(id)}?book=${book}`,
          {
            headers: { Authorization: `Bearer ${jwt}` },
          },
        );
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "load failed");
        setDetail(j);
        // saved renewal rate card, if any (non-fatal on error)
        try {
          const rc = await fetch(
            `${API}/office/plan/ratecard/${encodeURIComponent(id)}?book=${book}`,
            { headers: { Authorization: `Bearer ${jwt}` } },
          );
          const rj = await rc.json();
          const card = rc.ok && rj?.ok ? (rj.card ?? null) : null;
          setRateCard(card);
          setRcRows(cardToRows(card));
          setRcEff(card?.effectiveDate ?? "");
          setRcGuar(card?.rateGuaranteeMonths == null ? "" : String(card.rateGuaranteeMonths));
          setRcNote(card?.note ?? "");
        } catch {
          setRateCard(null);
          setRcRows([]);
          setRcEff("");
          setRcGuar("");
          setRcNote("");
        }
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

  // best-effort stop for navigation transitions (change book / client / hide)
  const stopPresentingSoft = () => {
    if (presentingRef.current) {
      void postPresent(null);
      setPresenting(false);
    }
  };

  const pickBook = (b: "eceb" | "demo") => {
    stopPresentingSoft();
    setBook(b);
    setResults([]);
    setDetail(null);
    setErr("");
  };

  // deliberate stop from the button: confirm the server ack before clearing
  const togglePresent = async () => {
    if (!detail) return;
    if (presenting) {
      setBusy("present");
      const ok = await postPresent(null);
      setBusy("");
      if (ok) setPresenting(false);
      else setFlash("Couldn't stop the share — the client may still see the plan. Tap Stop again.");
    } else {
      setBusy("present");
      const ok = await postPresent({ ...detail, rateCard });
      setBusy("");
      if (ok) {
        setPresenting(true);
        setFlash("");
      } else setFlash("Couldn't present — try again.");
    }
  };

  // Save the renewal rate card (droplet-side store). Saving with zero lines clears
  // it. If presenting, the room updates immediately with the saved card.
  const saveRateCard = async () => {
    if (!detail) return;
    const rows = rcRows
      .map((r) => ({
        benefit: String(r.benefit || "").trim(),
        tier: String(r.tier || "").trim(),
        currentRate: r.currentRate === "" ? null : Number(r.currentRate),
        currentPremium: r.currentPremium === "" ? null : Number(r.currentPremium),
        renewalRate: r.renewalRate === "" ? null : Number(r.renewalRate),
        renewalPremium: r.renewalPremium === "" ? null : Number(r.renewalPremium),
      }))
      .filter((r) => r.benefit !== "");
    setBusy("ratecard");
    setFlash("");
    try {
      const isClear = rows.length === 0;
      const body = isClear
        ? { card: null }
        : {
            card: {
              rows,
              effectiveDate: rcEff || null,
              rateGuaranteeMonths: rcGuar === "" ? null : Number(rcGuar),
              note: rcNote.trim() || null,
            },
          };
      const r = await fetch(
        `${API}/office/plan/ratecard/${encodeURIComponent(detail.employer.id)}?book=${book}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.error || "save failed");
      setRateCard(j.card);
      setRcRows(cardToRows(j.card));
      if (presentingRef.current) await postPresent({ ...detail, rateCard: j.card });
      setFlash(isClear ? "Rate card cleared." : "Rate card saved.");
      if (isClear) setRcOpen(false);
    } catch (e: any) {
      setFlash("Error: " + String(e?.message || e));
    } finally {
      setBusy("");
    }
  };

  const setRcRow = (i: number, patch: any) =>
    setRcRows((x) => x.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  // standard small-group benefit lines: tiered health/dental, volume-rated
  // life/AD&D/LTD (rate per $100), flat dependent life
  const seedRateRows = () =>
    setRcRows(
      [
        ["Extended health", "Single"],
        ["Extended health", "Family"],
        ["Dental", "Single"],
        ["Dental", "Family"],
        ["Life", "per $100"],
        ["AD&D", "per $100"],
        ["LTD", "per $100"],
        ["Dependent life", "flat"],
      ].map(([benefit, tier]) => ({ ...emptyRcRow(), benefit, tier })),
    );

  const hidePanel = () => {
    stopPresentingSoft();
    setOpen(false);
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
          headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
          body: JSON.stringify({ changes: payloadChanges(), note: "Adjusted in office review" }),
        },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "apply failed");
      setChanges([]);
      const fresh = await loadEmployer(detail.employer.id);
      if (presentingRef.current && fresh) await postPresent({ ...fresh, rateCard });
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
        headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
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
        <strong style={{ color: accent }}>◧ Client plan{presenting ? " · presenting" : ""}</strong>
        <button style={PM.x} onClick={hidePanel}>
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
              style={PM.input}
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
              stopPresentingSoft();
              setDetail(null);
            }}
          >
            ‹ Change client
          </button>
          <PlanBody detail={detail} accent={accent} />
          {rateCard && <RateCardTable card={rateCard} accent={accent} title="Renewal rates" />}

          {detail.plan && (
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button
                style={{
                  ...PM.adjust,
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
                  borderColor: accent,
                  color: rcOpen ? "#08120b" : accent,
                  background: rcOpen ? accent : "transparent",
                }}
                onClick={() => setRcOpen((v) => !v)}
              >
                {rcOpen ? "Done with rates" : "▤ Renewal rates"}
              </button>
              <button
                style={{
                  ...PM.adjust,
                  borderColor: presenting ? "#3fb950" : "#8b949e",
                  color: presenting ? "#08120b" : "#c9d4e0",
                  background: presenting ? "#3fb950" : "transparent",
                }}
                onClick={togglePresent}
                disabled={busy === "present"}
              >
                {busy === "present" ? "…" : presenting ? "■ Stop presenting" : "▶ Present to room"}
              </button>
            </div>
          )}

          {rcOpen && detail.plan && (
            <div style={PM.editor}>
              <div style={{ color: "#8b949e", fontSize: 12, marginBottom: 8 }}>
                Carrier re-rate for this renewal. Shown to the room when presenting — nothing is
                sent to the carrier. Premiums are monthly; rates for volume-rated lines.
              </div>
              {rcRows.length === 0 && (
                <button
                  style={{ ...PM.sendBtn, borderColor: accent, color: accent, width: "100%" }}
                  onClick={seedRateRows}
                >
                  Start from typical benefit lines
                </button>
              )}
              {rcRows.map((r, i) => (
                <div
                  key={i}
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: i === 0 ? "none" : "1px solid #1b2029",
                  }}
                >
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      style={{ ...PM.rcIn, flex: 1.6 }}
                      value={r.benefit}
                      onChange={(e) => setRcRow(i, { benefit: e.target.value })}
                      placeholder="Benefit (e.g. Extended health)"
                    />
                    <input
                      style={{ ...PM.rcIn, flex: 1 }}
                      value={r.tier}
                      onChange={(e) => setRcRow(i, { tier: e.target.value })}
                      placeholder="Single / Family / per $100"
                    />
                    <button
                      style={PM.rm}
                      onClick={() => setRcRows((x) => x.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  </div>
                  <div style={PM.rcInRow}>
                    <input
                      style={PM.rcIn}
                      type="number"
                      value={r.currentRate}
                      onChange={(e) => setRcRow(i, { currentRate: e.target.value })}
                      placeholder="cur rate"
                    />
                    <input
                      style={PM.rcIn}
                      type="number"
                      value={r.currentPremium}
                      onChange={(e) => setRcRow(i, { currentPremium: e.target.value })}
                      placeholder="cur $/mo"
                    />
                    <input
                      style={PM.rcIn}
                      type="number"
                      value={r.renewalRate}
                      onChange={(e) => setRcRow(i, { renewalRate: e.target.value })}
                      placeholder="new rate"
                    />
                    <input
                      style={PM.rcIn}
                      type="number"
                      value={r.renewalPremium}
                      onChange={(e) => setRcRow(i, { renewalPremium: e.target.value })}
                      placeholder="new $/mo"
                    />
                  </div>
                </div>
              ))}
              {rcRows.length > 0 && (
                <>
                  <button
                    style={{
                      ...PM.sendBtn,
                      borderColor: "#283040",
                      color: "#c9d4e0",
                      marginTop: 10,
                    }}
                    onClick={() => setRcRows((x) => [...x, emptyRcRow()])}
                  >
                    + Add line
                  </button>
                  <div style={PM.rcInRow}>
                    <input
                      style={PM.rcIn}
                      type="date"
                      value={rcEff}
                      onChange={(e) => setRcEff(e.target.value)}
                      title="Renewal effective date"
                    />
                    <input
                      style={PM.rcIn}
                      type="number"
                      value={rcGuar}
                      onChange={(e) => setRcGuar(e.target.value)}
                      placeholder="rate guarantee (months)"
                    />
                  </div>
                  <input
                    style={{ ...PM.rcIn, width: "100%", boxSizing: "border-box", marginTop: 6 }}
                    value={rcNote}
                    onChange={(e) => setRcNote(e.target.value)}
                    placeholder="note shown with the card (optional)"
                  />
                </>
              )}
              {(rcRows.length > 0 || rateCard) && (
                <button
                  style={{ ...PM.apply, background: accent, marginTop: 10, width: "100%" }}
                  onClick={saveRateCard}
                  disabled={busy !== ""}
                >
                  {busy === "ratecard"
                    ? "Saving…"
                    : rcRows.length === 0
                      ? "Save (clears the card)"
                      : presenting
                        ? "Save rate card (updates room)"
                        : "Save rate card"}
                </button>
              )}
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
                      {benefitLabel(b)}
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
                    type="email"
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
            <div
              style={{
                ...PM.flash,
                color:
                  flash.startsWith("Error") || flash.startsWith("Couldn") ? "#f85149" : "#3fb950",
              }}
            >
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
  benefitHead: { fontSize: 12.5, letterSpacing: ".02em", fontWeight: 800, marginBottom: 4 },
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
  rcHeadRow: {
    display: "flex",
    gap: 8,
    fontSize: 10.5,
    color: "#6a7681",
    padding: "4px 0 3px",
    borderBottom: "1px solid #283040",
    textTransform: "uppercase",
    letterSpacing: ".05em",
  },
  rcRow: {
    display: "flex",
    gap: 8,
    alignItems: "baseline",
    fontSize: 13.5,
    padding: "6px 0",
    borderTop: "1px solid #1b2029",
  },
  rcNumCol: { flex: 1, textAlign: "right" },
  rcPctCol: { width: 62, textAlign: "right" },
  rcInRow: { display: "flex", gap: 6, marginTop: 6 },
  rcIn: {
    flex: 1,
    minWidth: 0,
    padding: "7px 8px",
    borderRadius: 7,
    border: "1px solid #283040",
    background: "#11151c",
    color: "#e6edf3",
    fontSize: 12.5,
  },
};
