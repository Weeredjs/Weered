"use client";
// Shared renderers for the three-tab consult: the full renewal REVIEW document
// and the sign-off PROPOSAL (current / renewal / our target / with changes +
// forecasts). Host panel and guest viewer draw the SAME components from the
// same (whitelisted) payload — what the broker sees is what the client sees.
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
const pctColor = (p: any) =>
  typeof p !== "number" ? "#8b949e" : p > 0 ? "#f0883e" : p < 0 ? "#3fb950" : "#8b949e";
const rangeTxt = (v: any): string => {
  if (v && typeof v === "object") {
    const lo = typeof v.low === "number" ? money(v.low) : null;
    const hi = typeof v.high === "number" ? money(v.high) : null;
    if (lo && hi) return `${lo}–${hi}`;
    return lo || hi || "—";
  }
  return money(v);
};

const S: Record<string, CSSProperties> = {
  section: { marginTop: 16 },
  h: { fontSize: 12.5, letterSpacing: ".05em", fontWeight: 800, marginBottom: 6 },
  card: {
    border: "1px solid #283040",
    borderRadius: 10,
    background: "#0d1117",
    padding: "10px 12px",
    marginTop: 6,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 13,
    padding: "5px 0",
    borderTop: "1px solid #1b2029",
  },
  small: { color: "#8b949e", fontSize: 12 },
  tiny: { color: "#6a7681", fontSize: 11 },
  thRow: {
    display: "flex",
    gap: 8,
    fontSize: 10.5,
    color: "#6a7681",
    textTransform: "uppercase",
    letterSpacing: ".05em",
    padding: "4px 0 3px",
    borderBottom: "1px solid #283040",
  },
  num: { flex: 1, textAlign: "right" },
  bar: {
    height: 7,
    background: "#0d1117",
    border: "1px solid #1b2029",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 3,
  },
  badge: {
    fontSize: 10.5,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #2e4a2e",
    background: "rgba(63,185,80,0.08)",
    color: "#7ee787",
    whiteSpace: "nowrap",
  },
};

const KIND_ICON: Record<string, string> = { warn: "⚠", info: "ⓘ", lever: "⚡" };
const KIND_COLOR: Record<string, string> = { warn: "#f0883e", info: "#8b949e", lever: "#e0b341" };

export function ReviewDoc({ review, accent }: { review: any; accent: string }) {
  if (!review || !review.headline) return null;
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
          <span style={{ fontSize: 30, fontWeight: 900, color: pctColor(h.pct) }}>
            {pct2(h.pct)}
          </span>
          {typeof h.monthlyFrom === "number" && typeof h.monthlyTo === "number" && (
            <span style={{ fontSize: 14, color: "#c9d4e0" }}>
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
          <div style={{ ...S.h, color: accent }}>
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
              <span style={{ flex: 1.3, color: "#e6edf3" }}>{r.benefit}</span>
              <span
                style={{ ...S.num, color: overTarget(r) ? "#f85149" : "#c9d4e0", fontWeight: 700 }}
              >
                {plainPct(r.lossRatio)}
              </span>
              <span style={{ ...S.num, color: "#8b949e" }}>{plainPct(r.credibility)}</span>
              <span style={{ ...S.num, color: pctColor(r.rateChangePct), fontWeight: 700 }}>
                {pctTxt(r.rateChangePct)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* drivers */}
      {review.drivers?.length > 0 && (
        <div style={S.section}>
          <div style={{ ...S.h, color: accent }}>WHAT&apos;S DRIVING IT</div>
          {review.drivers.map((d: any, i: number) => (
            <div key={i} style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#e6edf3" }}>
                <span style={{ color: KIND_COLOR[d.kind] || "#8b949e", marginRight: 6 }}>
                  {KIND_ICON[d.kind] || "ⓘ"}
                </span>
                {d.title}
              </div>
              {d.body && <div style={{ ...S.small, marginTop: 4, lineHeight: 1.5 }}>{d.body}</div>}
            </div>
          ))}
        </div>
      )}

      {/* roadmap */}
      {review.roadmap && (
        <div style={S.section}>
          <div style={{ ...S.h, color: accent }}>RENEWAL ROADMAP</div>
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
                  background: accent,
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
                <span style={{ fontSize: 13, fontWeight: 800, color: "#e6edf3" }}>{it.title}</span>
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
          <div style={{ ...S.h, color: accent }}>DIAGNOSIS &amp; PLAN</div>
          {review.diagnosis.map((s: string, i: number) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, padding: "3px 0" }}>
              <span style={{ color: accent }}>•</span>
              <span style={{ color: "#c9d4e0", lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* scenarios */}
      {review.scenarios?.length > 0 && (
        <div style={{ ...S.section, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {review.scenarios.map((s: any, i: number) => (
            <div key={i} style={{ ...S.card, marginTop: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: accent }}>{s.title}</div>
              <div style={{ ...S.small, marginTop: 4, lineHeight: 1.5 }}>{s.body}</div>
            </div>
          ))}
        </div>
      )}

      {/* levers */}
      {review.levers?.length > 0 && (
        <div style={S.section}>
          <div style={{ ...S.h, color: accent }}>LEVERS TO FORCE A BETTER OUTCOME</div>
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
                <span style={{ fontSize: 13, fontWeight: 800, color: "#e6edf3" }}>{l.title}</span>
                {typeof l.saveLow === "number" && typeof l.saveHigh === "number" ? (
                  <span style={S.badge}>
                    save ~{money0(l.saveLow)}–{money0(l.saveHigh)}/yr
                  </span>
                ) : l.badge ? (
                  <span style={S.badge}>{l.badge}</span>
                ) : null}
              </div>
              {l.body && <div style={{ ...S.small, marginTop: 4, lineHeight: 1.5 }}>{l.body}</div>}
            </div>
          ))}
        </div>
      )}

      {/* demographics */}
      {review.demographics && (
        <div style={S.section}>
          <div style={{ ...S.h, color: accent }}>GROUP</div>
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
                <div style={{ fontSize: 20, fontWeight: 900, color: accent }}>
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
                          background: accent,
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
                    border: "1px solid #283040",
                    color: "#c9d4e0",
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
        <div style={{ ...S.card, borderColor: "#2e4a2e" }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#7ee787" }}>
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

export function ProposalDoc({ proposal, accent }: { proposal: any; accent: string }) {
  if (!proposal || !Array.isArray(proposal.lines) || !proposal.lines.length) return null;
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
            <span style={{ color: "#e6edf3" }}>{l.benefit}</span>
            {l.tier ? <span style={S.tiny}> · {l.tier}</span> : null}
          </span>
          <span style={{ ...S.num, color: "#8b949e" }}>{money(l.current)}</span>
          <span style={{ ...S.num, color: "#f0883e" }}>{money(l.renewal)}</span>
          <span style={{ ...S.num, color: accent, fontWeight: 700 }}>
            {rangeTxt(l.appealTarget)}
          </span>
          <span style={{ ...S.num, color: "#3fb950", fontWeight: 700 }}>
            {money(l.withChanges)}
          </span>
        </div>
      ))}
      <div style={{ ...S.row, borderTop: "1px solid #283040", fontWeight: 800 }}>
        <span style={{ flex: 1.3 }}>Total monthly</span>
        <span style={{ ...S.num, color: "#c9d4e0" }}>{money(t.current)}</span>
        <span style={{ ...S.num, color: "#f0883e" }}>
          {money(t.renewal)}
          <span style={{ ...S.tiny, marginLeft: 4 }}>{pctTxt(t.renewalPct)}</span>
        </span>
        <span style={{ ...S.num, color: accent }}>
          {rangeTxt(t.appealTarget)}
          <span style={{ ...S.tiny, marginLeft: 4 }}>{pctTxt(t.appealPct)}</span>
        </span>
        <span style={{ ...S.num, color: "#3fb950" }}>
          {money(t.withChanges)}
          <span style={{ ...S.tiny, marginLeft: 4 }}>{pctTxt(t.withChangesPct)}</span>
        </span>
      </div>

      {proposal.appealBasis?.length > 0 && (
        <div style={S.section}>
          <div style={{ ...S.h, color: accent }}>WHY OUR TARGET IS DEFENSIBLE</div>
          {proposal.appealBasis.map((s: string, i: number) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, padding: "3px 0" }}>
              <span style={{ color: accent }}>•</span>
              <span style={{ color: "#c9d4e0", lineHeight: 1.5 }}>{s}</span>
            </div>
          ))}
        </div>
      )}

      {proposal.forecasts?.length > 0 && (
        <div style={S.section}>
          <div style={{ ...S.h, color: accent }}>WHERE THE NEXT RENEWAL LANDS</div>
          <div style={S.thRow}>
            <span style={{ flex: 1.6 }}>Scenario</span>
            <span style={S.num}>Next renewal</span>
            <span style={{ ...S.num, maxWidth: 70 }}>Change</span>
          </div>
          {proposal.forecasts.map((f: any, i: number) => (
            <div key={i} style={{ ...S.row, ...(i === 0 ? { borderTop: "none" } : {}) }}>
              <span style={{ flex: 1.6 }}>
                <span style={{ color: "#e6edf3" }}>{f.label || f.scenario}</span>
                {f.notes ? <div style={S.tiny}>{f.notes}</div> : null}
              </span>
              <span style={{ ...S.num, fontWeight: 700 }}>{money0(f.nextRenewalAnnual)}</span>
              <span
                style={{ ...S.num, maxWidth: 70, color: pctColor(f.changePct), fontWeight: 700 }}
              >
                {pctTxt(f.changePct)}
              </span>
            </div>
          ))}
        </div>
      )}

      {proposal.benchmark && (
        <div style={{ ...S.card, borderColor: "#2e4a2e" }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#7ee787" }}>
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
