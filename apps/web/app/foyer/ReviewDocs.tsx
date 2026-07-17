"use client";
// Shared renderers for the three-tab consult: the full renewal REVIEW document
// and the sign-off PROPOSAL (current / renewal / our target / with changes +
// forecasts). Host panel and guest viewer draw the SAME components from the
// same (whitelisted) payload — what the broker sees is what the client sees.
import { useState } from "react";
import type { CSSProperties } from "react";

// UNIT CONTRACT (verified against the live engine payload): every percentage
// arrives in PERCENT UNITS — lossRatio 326.71 means 326.71%, credibility 84.38,
// target 74.25, pct 14.96, rateChangePct 42.0, pctElapsed 74. Render as-is;
// NEVER multiply by 100. (The projection endpoint's overallLossRatio is the one
// fraction-unit exception, handled where it renders.)
const money = (n: any): string =>
  typeof n === "number" ? "$" + n.toLocaleString("en-CA", { maximumFractionDigits: 2 }) : "—";
const money0 = (n: any): string =>
  typeof n === "number" ? "$" + Math.round(n).toLocaleString("en-CA") : "—";
const pctTxt = (p: any): string =>
  typeof p === "number" ? `${p > 0 ? "+" : ""}${p.toFixed(1)}%` : "—";
// headline precision: +14.96% must never round to +15.0% — the broker quotes it
const pct2 = (p: any): string =>
  typeof p === "number" ? `${p > 0 ? "+" : ""}${p.toFixed(2)}%` : "—";
const plainPct = (p: any): string => (typeof p === "number" ? `${p.toFixed(2)}%` : "—");
// Engine prose sometimes carries full-precision floats ("+60.7369%" / "5.0043%");
// round any percentage with 3+ decimals to one place. Clean 2-place values
// (e.g. +14.96%) are left untouched.
const tidyPct = (s: any): string =>
  typeof s === "string"
    ? s.replace(
        /(\d+)\.(\d{3,})%/g,
        (_m: string, w: string, d: string) =>
          (Math.round(parseFloat(w + "." + d) * 10) / 10).toFixed(1) + "%",
      )
    : s;
const rangeTxt = (v: any): string => {
  if (v && typeof v === "object") {
    const lo = typeof v.low === "number" ? money(v.low) : null;
    const hi = typeof v.high === "number" ? money(v.high) : null;
    if (lo && hi) return `${lo}–${hi}`;
    return lo || hi || "—";
  }
  return money(v);
};

// The renderer is theme-aware: DARK for the broker's operator rail (Weered), a
// LIGHT "benefits document" palette for the client-facing consult (matches the
// ECEB website; dense number tables read far better on white). Headings use
// navy on light / gold(accent) on dark; gold-on-white is too low-contrast.
export type Pal = {
  card: string;
  cardBorder: string;
  rowLine: string;
  barBg: string;
  barBorder: string;
  text: string;
  strong: string;
  muted: string;
  faint: string;
  head: string;
  up: string;
  down: string;
  neutral: string;
  over: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  leverIcon: string;
};
const DARK: Pal = {
  card: "#0e2038",
  cardBorder: "#233a5e",
  rowLine: "#1c3150",
  barBg: "#081525",
  barBorder: "#1c3150",
  text: "#e6edf3",
  strong: "#e6edf3",
  muted: "#8b949e",
  faint: "#6a7681",
  head: "#e0b341",
  up: "#f0883e",
  down: "#3fb950",
  neutral: "#8b949e",
  over: "#f85149",
  badgeBg: "rgba(63,185,80,0.08)",
  badgeBorder: "#2e4a2e",
  badgeText: "#7ee787",
  leverIcon: "#e0b341",
};
const LIGHT: Pal = {
  card: "#ffffff",
  cardBorder: "#d6dfea",
  rowLine: "#e6ecf3",
  barBg: "#eef2f7",
  barBorder: "#d6dfea",
  text: "#1c2733",
  strong: "#14233D",
  muted: "#5a6b83",
  faint: "#8593a6",
  head: "#14233D",
  up: "#c26a12",
  down: "#1a7a3c",
  neutral: "#5a6b83",
  over: "#c0392b",
  badgeBg: "#e8f5ec",
  badgeBorder: "#bcdfc7",
  badgeText: "#1a7a3c",
  leverIcon: "#9a7b16",
};

const mkS = (P: Pal): Record<string, CSSProperties> => ({
  section: { marginTop: 16 },
  h: { fontSize: 12.5, letterSpacing: ".05em", fontWeight: 800, marginBottom: 6 },
  card: {
    border: `1px solid ${P.cardBorder}`,
    borderRadius: 5,
    background: P.card,
    padding: "10px 12px",
    marginTop: 6,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 13,
    padding: "5px 0",
    borderTop: `1px solid ${P.rowLine}`,
  },
  small: { color: P.muted, fontSize: 12 },
  tiny: { color: P.faint, fontSize: 11 },
  thRow: {
    display: "flex",
    gap: 8,
    fontSize: 10.5,
    color: P.faint,
    textTransform: "uppercase",
    letterSpacing: ".05em",
    padding: "4px 0 3px",
    borderBottom: `1px solid ${P.cardBorder}`,
  },
  num: { flex: 1, textAlign: "right" },
  bar: {
    height: 7,
    background: P.barBg,
    border: `1px solid ${P.barBorder}`,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 3,
  },
  badge: {
    fontSize: 10.5,
    padding: "2px 8px",
    borderRadius: 999,
    border: `1px solid ${P.badgeBorder}`,
    background: P.badgeBg,
    color: P.badgeText,
    whiteSpace: "nowrap",
  },
});

const KIND_ICON: Record<string, string> = { warn: "⚠", info: "ⓘ", lever: "⚡" };
const kindColor = (P: Pal): Record<string, string> => ({
  warn: P.up,
  info: P.muted,
  lever: P.leverIcon,
});

// Shared so the PlanModule presented components (plan body, rate card,
// projection) theme from the exact same tokens as the review/proposal docs.
export const fathomPal = (light?: boolean): Pal => (light ? LIGHT : DARK);

// "DEPLOYABLE" DETAIL — the paediatrician contract. The client reads a plain
// statement; if the engine attaches the figure(s) behind it, the statement
// becomes click-to-reveal ("Where did you get that?" → *click* → the numbers
// that produced it). Backward compatible: a bare string, or a { plain } with no
// detail/figures, renders as flat text with no affordance. Any diagnosis line,
// driver, lever, or appeal-basis line can carry:
//   detail?: string                       — the underlying reasoning in one line
//   figures?: { label: string; value: string }[]  — the raw numbers, as a table
export type Figure = { label: string; value: string };
export type Deployable = string | { plain: string; detail?: string; figures?: Figure[] };
const hasDetail = (d: any): boolean =>
  !!d &&
  typeof d === "object" &&
  (!!d.detail || (Array.isArray(d.figures) && d.figures.length > 0));

// The revealed panel (figure table + one-line reasoning). Shared by both the
// bullet-line and card-embedded disclosures so the deployed state looks identical.
function FigurePanel({ detail, figures, P }: { detail?: string; figures?: Figure[]; P: Pal }) {
  const S = mkS(P);
  return (
    <div style={{ ...S.card, marginTop: 5, background: P.barBg }}>
      {(figures || []).map((f, i) => (
        <div
          key={i}
          style={{ ...S.row, ...(i === 0 ? { borderTop: "none" } : {}), fontSize: 12.5 }}
        >
          <span style={{ color: P.muted }}>{f.label}</span>
          <span style={{ color: P.strong, fontWeight: 700, textAlign: "right" }}>{f.value}</span>
        </div>
      ))}
      {detail && (
        <div style={{ ...S.small, marginTop: figures && figures.length ? 6 : 0, lineHeight: 1.5 }}>
          {detail}
        </div>
      )}
    </div>
  );
}

// A bulleted plain statement that deploys to its figure. Used for diagnosis and
// the proposal's appeal basis (both currently flat string lists).
function DeployableLine({ item, P, head }: { item: Deployable; P: Pal; head: string }) {
  const [open, setOpen] = useState(false);
  const plain = tidyPct(typeof item === "string" ? item : item.plain);
  if (!hasDetail(item)) {
    return (
      <div style={{ display: "flex", gap: 8, fontSize: 13, padding: "3px 0" }}>
        <span style={{ color: head }}>•</span>
        <span style={{ color: P.text, lineHeight: 1.5 }}>{plain}</span>
      </div>
    );
  }
  const d = item as { plain: string; detail?: string; figures?: Figure[] };
  return (
    <div style={{ padding: "3px 0" }}>
      <div style={{ display: "flex", gap: 8, fontSize: 13 }}>
        <span style={{ color: head }}>•</span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Show the figure behind this"
          style={{
            all: "unset",
            cursor: "pointer",
            color: P.text,
            lineHeight: 1.5,
            borderBottom: `1px dotted ${P.faint}`,
          }}
        >
          {plain}
          <span style={{ color: head, marginLeft: 6, fontSize: 11 }}>{open ? "▾" : "▸"}</span>
        </button>
      </div>
      {open && (
        <div style={{ marginLeft: 16 }}>
          <FigurePanel detail={d.detail} figures={d.figures} P={P} />
        </div>
      )}
    </div>
  );
}

// A subtle "where this comes from" toggle for card-embedded statements (drivers,
// levers) that already have a title + body. Renders nothing if no figure is
// attached, so existing payloads are untouched.
function FigureReveal({
  detail,
  figures,
  P,
  head,
}: {
  detail?: string;
  figures?: Figure[];
  P: Pal;
  head: string;
}) {
  const [open, setOpen] = useState(false);
  if (!detail && !(figures && figures.length)) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          all: "unset",
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: ".03em",
          color: head,
        }}
      >
        {open ? "▾ hide the figure" : "▸ where this comes from"}
      </button>
      {open && <FigurePanel detail={detail} figures={figures} P={P} />}
    </div>
  );
}

export function ReviewDoc({
  review,
  accent,
  light,
}: {
  review: any;
  accent: string;
  light?: boolean;
}) {
  if (!review || !review.headline) return null;
  const P = light ? LIGHT : DARK;
  const S = mkS(P);
  const head = P.head;
  const KC = kindColor(P);
  const pcolor = (p: any) =>
    typeof p !== "number" ? P.neutral : p > 0 ? P.up : p < 0 ? P.down : P.neutral;
  const h = review.headline;
  const overTarget = (r: any) =>
    typeof r.lossRatio === "number" && typeof r.target === "number" && r.lossRatio > r.target;
  return (
    <div>
      {/* headline */}
      <div style={{ ...S.card, borderColor: accent, padding: "14px 14px" }}>
        <div style={{ ...S.tiny, textTransform: "uppercase", letterSpacing: ".08em" }}>
          {[h.carrier, h.policy ? `Policy ${h.policy}` : null].filter(Boolean).join(" · ") ||
            "Renewal"}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 2 }}>
          <span style={{ fontSize: 30, fontWeight: 900, color: pcolor(h.pct) }}>{pct2(h.pct)}</span>
          {typeof h.monthlyFrom === "number" && typeof h.monthlyTo === "number" && (
            <span style={{ fontSize: 14, color: P.text }}>
              {money0(h.monthlyFrom)} → <b>{money0(h.monthlyTo)}</b>/mo
              {typeof h.annualDelta === "number" ? ` · ≈${money0(h.annualDelta)}/yr` : ""}
            </span>
          )}
        </div>
        <div style={{ ...S.small, marginTop: 4 }}>
          {[
            h.effective ? `Effective ${h.effective}` : null,
            h.experienceWindow ? `experience ${h.experienceWindow}` : null,
            typeof h.lives === "number" ? `${h.lives} lives` : null,
            typeof h.avgAgeFrom === "number" && typeof h.avgAgeTo === "number"
              ? `avg age ${h.avgAgeFrom} → ${h.avgAgeTo}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>

      {/* loss ratios */}
      {review.lossRatios?.length > 0 && (
        <div style={S.section}>
          <div style={{ ...S.h, color: head }}>
            LOSS RATIO VS TARGET
            {typeof review.lossRatios[0]?.target === "number"
              ? ` (${plainPct(review.lossRatios[0].target)})`
              : ""}
          </div>
          <div style={S.thRow}>
            <span style={{ flex: 1.3 }}>Benefit</span>
            <span style={S.num}>Loss ratio</span>
            <span style={S.num}>Credibility</span>
            <span style={S.num}>Rate change</span>
          </div>
          {review.lossRatios.map((r: any, i: number) => (
            <div key={i} style={{ ...S.row, ...(i === 0 ? { borderTop: "none" } : {}) }}>
              <span style={{ flex: 1.3, color: P.strong }}>{r.benefit}</span>
              <span style={{ ...S.num, color: overTarget(r) ? P.over : P.text, fontWeight: 700 }}>
                {plainPct(r.lossRatio)}
              </span>
              <span style={{ ...S.num, color: P.muted }}>{plainPct(r.credibility)}</span>
              <span style={{ ...S.num, color: pcolor(r.rateChangePct), fontWeight: 700 }}>
                {pctTxt(r.rateChangePct)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* drivers */}
      {review.drivers?.length > 0 && (
        <div style={S.section}>
          <div style={{ ...S.h, color: head }}>WHAT&apos;S DRIVING IT</div>
          {review.drivers.map((d: any, i: number) => (
            <div key={i} style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 800, color: P.strong }}>
                <span style={{ color: KC[d.kind] || P.muted, marginRight: 6 }}>
                  {KIND_ICON[d.kind] || "ⓘ"}
                </span>
                {d.title}
              </div>
              {d.body && <div style={{ ...S.small, marginTop: 4, lineHeight: 1.5 }}>{d.body}</div>}
              <FigureReveal detail={d.detail} figures={d.figures} P={P} head={head} />
            </div>
          ))}
        </div>
      )}

      {/* roadmap */}
      {review.roadmap && (
        <div style={S.section}>
          <div style={{ ...S.h, color: head }}>RENEWAL ROADMAP</div>
          <div style={S.small}>
            {[
              review.roadmap.renewsAt ? `Renews ${review.roadmap.renewsAt}` : null,
              review.roadmap.windowClosesAt
                ? `experience window closes ${review.roadmap.windowClosesAt}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {typeof review.roadmap.pctElapsed === "number" && (
            <div style={S.bar}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, Math.max(0, review.roadmap.pctElapsed))}%`,
                  background: head,
                }}
              />
            </div>
          )}
          {(review.roadmap.items || []).map((it: any, i: number) => (
            <div key={i} style={S.card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: P.strong }}>{it.title}</span>
                {it.badge && <span style={S.badge}>{it.badge}</span>}
              </div>
              {it.body && (
                <div style={{ ...S.small, marginTop: 4, lineHeight: 1.5 }}>{it.body}</div>
              )}
              {it.due && <div style={{ ...S.tiny, marginTop: 4 }}>{it.due}</div>}
            </div>
          ))}
        </div>
      )}

      {/* diagnosis */}
      {review.diagnosis?.length > 0 && (
        <div style={S.section}>
          <div style={{ ...S.h, color: head }}>DIAGNOSIS &amp; PLAN</div>
          {review.diagnosis.map((s: Deployable, i: number) => (
            <DeployableLine key={i} item={s} P={P} head={head} />
          ))}
        </div>
      )}

      {/* scenarios */}
      {review.scenarios?.length > 0 && (
        <div style={{ ...S.section, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {review.scenarios.map((s: any, i: number) => (
            <div key={i} style={{ ...S.card, marginTop: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: head }}>{s.title}</div>
              <div style={{ ...S.small, marginTop: 4, lineHeight: 1.5 }}>{s.body}</div>
            </div>
          ))}
        </div>
      )}

      {/* levers */}
      {review.levers?.length > 0 && (
        <div style={S.section}>
          <div style={{ ...S.h, color: head }}>LEVERS TO FORCE A BETTER OUTCOME</div>
          {review.levers.map((l: any, i: number) => (
            <div key={i} style={S.card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: P.strong }}>{l.title}</span>
                {typeof l.saveLow === "number" && typeof l.saveHigh === "number" ? (
                  <span style={S.badge}>
                    save ~{money0(l.saveLow)}–{money0(l.saveHigh)}/yr
                  </span>
                ) : l.badge ? (
                  <span style={S.badge}>{l.badge}</span>
                ) : null}
              </div>
              {l.body && <div style={{ ...S.small, marginTop: 4, lineHeight: 1.5 }}>{l.body}</div>}
              <FigureReveal detail={l.detail} figures={l.figures} P={P} head={head} />
            </div>
          ))}
        </div>
      )}

      {/* demographics */}
      {review.demographics && (
        <div style={S.section}>
          <div style={{ ...S.h, color: head }}>GROUP</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {typeof review.demographics.lives === "number" && (
              <div style={{ ...S.card, marginTop: 0, flex: 1, minWidth: 90 }}>
                <div style={S.tiny}>LIVES</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{review.demographics.lives}</div>
              </div>
            )}
            {typeof review.demographics.avgAge === "number" && (
              <div style={{ ...S.card, marginTop: 0, flex: 1, minWidth: 90 }}>
                <div style={S.tiny}>AVG AGE</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: head }}>
                  {review.demographics.avgAge}
                </div>
              </div>
            )}
            {review.demographics.dobOnFile && (
              <div style={{ ...S.card, marginTop: 0, flex: 1, minWidth: 90 }}>
                <div style={S.tiny}>DOB ON FILE</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{review.demographics.dobOnFile}</div>
              </div>
            )}
          </div>
          {review.demographics.ageBands?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {(() => {
                const max = Math.max(
                  ...review.demographics.ageBands.map((b: any) => b.count || 0),
                  1,
                );
                return review.demographics.ageBands.map((b: any, i: number) => (
                  <div
                    key={i}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}
                  >
                    <span style={{ ...S.tiny, width: 52 }}>{b.band}</span>
                    <div style={{ ...S.bar, flex: 1, marginTop: 0 }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${((b.count || 0) / max) * 100}%`,
                          background: head,
                          opacity: 0.75,
                        }}
                      />
                    </div>
                    <span style={{ ...S.tiny, width: 20, textAlign: "right" }}>{b.count}</span>
                  </div>
                ));
              })()}
            </div>
          )}
          {review.demographics.coverageMix?.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {review.demographics.coverageMix.map((c: any, i: number) => (
                <span
                  key={i}
                  style={{
                    fontSize: 11.5,
                    padding: "3px 10px",
                    borderRadius: 999,
                    border: `1px solid ${P.cardBorder}`,
                    color: P.text,
                  }}
                >
                  {c.label} · {c.count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* benchmark */}
      {review.benchmark && (
        <div style={{ ...S.card, borderColor: P.badgeBorder }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: P.badgeText }}>
            BENCHMARK{review.benchmark.verdict ? ` · ${review.benchmark.verdict}` : ""}
            {review.benchmark.scope ? (
              <span style={{ ...S.tiny, fontWeight: 400 }}> ({review.benchmark.scope})</span>
            ) : null}
          </div>
          {review.benchmark.note && (
            <div style={{ ...S.small, marginTop: 3, lineHeight: 1.5 }}>{review.benchmark.note}</div>
          )}
        </div>
      )}

      {/* disclaimers */}
      {review.disclaimers?.length > 0 && (
        <div style={{ ...S.tiny, marginTop: 12, lineHeight: 1.5 }}>
          {review.disclaimers.join(" ")}
        </div>
      )}
      <div style={{ ...S.tiny, marginTop: 10, letterSpacing: ".04em" }}>
        Prepared with Fathom · East Coast Employee Benefits
      </div>
    </div>
  );
}

export function ProposalDoc({
  proposal,
  accent,
  light,
}: {
  proposal: any;
  accent: string;
  light?: boolean;
}) {
  if (!proposal || !Array.isArray(proposal.lines) || !proposal.lines.length) return null;
  const P = light ? LIGHT : DARK;
  const S = mkS(P);
  const head = P.head;
  const pcolor = (p: any) =>
    typeof p !== "number" ? P.neutral : p > 0 ? P.up : p < 0 ? P.down : P.neutral;
  const t = proposal.totals || {};
  return (
    <div>
      <div style={S.thRow}>
        <span style={{ flex: 1.3 }}>Benefit</span>
        <span style={S.num}>Current</span>
        <span style={S.num}>Renewal</span>
        <span style={S.num}>Our target</span>
        <span style={S.num}>With changes</span>
      </div>
      {proposal.lines.map((l: any, i: number) => (
        <div key={i} style={{ ...S.row, ...(i === 0 ? { borderTop: "none" } : {}) }}>
          <span style={{ flex: 1.3 }}>
            <span style={{ color: P.strong }}>{l.benefit}</span>
            {l.tier ? <span style={S.tiny}> · {l.tier}</span> : null}
          </span>
          <span style={{ ...S.num, color: P.muted }}>{money(l.current)}</span>
          <span style={{ ...S.num, color: P.up }}>{money(l.renewal)}</span>
          <span style={{ ...S.num, color: head, fontWeight: 700 }}>{rangeTxt(l.appealTarget)}</span>
          <span style={{ ...S.num, color: P.down, fontWeight: 700 }}>{money(l.withChanges)}</span>
        </div>
      ))}
      <div style={{ ...S.row, borderTop: `1px solid ${P.cardBorder}`, fontWeight: 800 }}>
        <span style={{ flex: 1.3 }}>Total monthly</span>
        <span style={{ ...S.num, color: P.text }}>{money(t.current)}</span>
        <span style={{ ...S.num, color: P.up }}>
          {money(t.renewal)}
          <span style={{ ...S.tiny, marginLeft: 4 }}>{pctTxt(t.renewalPct)}</span>
        </span>
        <span style={{ ...S.num, color: head }}>
          {rangeTxt(t.appealTarget)}
          <span style={{ ...S.tiny, marginLeft: 4 }}>{pctTxt(t.appealPct)}</span>
        </span>
        <span style={{ ...S.num, color: P.down }}>
          {money(t.withChanges)}
          <span style={{ ...S.tiny, marginLeft: 4 }}>{pctTxt(t.withChangesPct)}</span>
        </span>
      </div>

      {proposal.appealBasis?.length > 0 && (
        <div style={S.section}>
          <div style={{ ...S.h, color: head }}>WHY OUR TARGET IS DEFENSIBLE</div>
          {proposal.appealBasis.map((s: Deployable, i: number) => (
            <DeployableLine key={i} item={s} P={P} head={head} />
          ))}
        </div>
      )}

      {proposal.forecasts?.length > 0 && (
        <div style={S.section}>
          <div style={{ ...S.h, color: head }}>WHERE THE NEXT RENEWAL LANDS</div>
          <div style={S.thRow}>
            <span style={{ flex: 1.6 }}>Scenario</span>
            <span style={S.num}>Next renewal</span>
            <span style={{ ...S.num, maxWidth: 70 }}>Change</span>
          </div>
          {proposal.forecasts.map((f: any, i: number) => (
            <div key={i} style={{ ...S.row, ...(i === 0 ? { borderTop: "none" } : {}) }}>
              <span style={{ flex: 1.6 }}>
                <span style={{ color: P.strong }}>{f.label || f.scenario}</span>
                {f.notes ? <div style={S.tiny}>{f.notes}</div> : null}
              </span>
              <span style={{ ...S.num, fontWeight: 700 }}>{money0(f.nextRenewalAnnual)}</span>
              <span style={{ ...S.num, maxWidth: 70, color: pcolor(f.changePct), fontWeight: 700 }}>
                {pctTxt(f.changePct)}
              </span>
            </div>
          ))}
        </div>
      )}

      {proposal.benchmark && (
        <div style={{ ...S.card, borderColor: P.badgeBorder }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: P.badgeText }}>
            BENCHMARK{proposal.benchmark.verdict ? ` · ${proposal.benchmark.verdict}` : ""}
            {proposal.benchmark.scope ? (
              <span style={{ ...S.tiny, fontWeight: 400 }}> ({proposal.benchmark.scope})</span>
            ) : null}
          </div>
          {proposal.benchmark.note && (
            <div style={{ ...S.small, marginTop: 3, lineHeight: 1.5 }}>
              {proposal.benchmark.note}
            </div>
          )}
        </div>
      )}

      {proposal.disclaimers?.length > 0 && (
        <div style={{ ...S.tiny, marginTop: 12, lineHeight: 1.5 }}>
          {proposal.disclaimers.join(" ")}
        </div>
      )}
      <div style={{ ...S.tiny, marginTop: 10, letterSpacing: ".04em" }}>
        Prepared with Fathom · East Coast Employee Benefits
      </div>
    </div>
  );
}
