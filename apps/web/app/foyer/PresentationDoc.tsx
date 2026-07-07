"use client";
// The client-facing PRESENTATION — the "beautiful PDF that changes live" the
// broker screen-shares/presents in the room. It mirrors the engine's chrome-free
// /broker/present/[slug] document (navy/gold benefits-document look), but is
// driven by the LIVE presented payload (review + projection): when the broker
// toggles a lever in the office tab, the projection snapshot changes and this
// re-renders, so the gauge and outlook animate in front of the client.
//
// READ-ONLY by design: the client never toggles anything and this never does its
// own loss-ratio math (that would risk mixing premium/experience bases). It shows
// exactly what the host presents. If the engine adds `projection.lossRatio`
// {current, withLevers, target} (percent units), the gauge upgrades to the exact
// loss-ratio story automatically; until then it tracks the renewal premium, which
// is always available and unit-safe.
import type { CSSProperties } from "react";

const money0 = (n: any): string =>
  typeof n === "number" ? "$" + Math.round(n).toLocaleString("en-CA") : "—";
const pctTxt = (p: any, dp = 1): string =>
  typeof p === "number" ? `${p > 0 ? "+" : ""}${p.toFixed(dp)}%` : "—";
const plainPct = (p: any): string => (typeof p === "number" ? `${p.toFixed(0)}%` : "—");

type Figure = { label: string; value: string };
const figuresOf = (x: any): Figure[] =>
  Array.isArray(x?.figures)
    ? x.figures
        .map((f: any) => ({ label: String(f?.label ?? ""), value: String(f?.value ?? "") }))
        .filter((f: Figure) => f.label || f.value)
    : [];

// The engine's presentation CSS, scoped under .fpres so it can't leak into the
// dark Weered chrome around it. Kept close to source for visual fidelity.
const CSS = `
.fpres{--navy:#0d3b66;--gold:#f4b81e;--gold-soft:#fff6df;--ground:#fff;--panel:#f4f7fb;--panel-2:#eef3f9;--line:#dfe6ee;--line-2:#e9eef5;--ink:#182231;--ink-soft:#41506a;--ink-mute:#7a879c;--good:#1a7a4a;--good-soft:#e7f3ec;--hot:#c0392b;--hot-soft:#fbeae7;--warn:#b07414;--warn-soft:#fbf0dc;--shadow:0 1px 2px rgba(13,59,102,.05),0 6px 22px rgba(13,59,102,.07);--sans:"Segoe UI",-apple-system,BlinkMacSystemFont,Calibri,Roboto,"Helvetica Neue",Arial,sans-serif;background:var(--ground);color:var(--ink);font-family:var(--sans);font-size:16px;line-height:1.56;-webkit-font-smoothing:antialiased;border-radius:8px;}
.fpres *{box-sizing:border-box;}
.fpres .doc{max-width:760px;margin:0 auto;padding:0 22px 40px;}
.fpres .doc>section{padding-top:30px;margin-top:30px;border-top:1px solid var(--line);}
.fpres h1{font-size:clamp(24px,4vw,33px);line-height:1.15;margin:10px 0 0;color:var(--navy);font-weight:700;letter-spacing:-.005em;}
.fpres h2{font-size:clamp(18px,2.6vw,22px);line-height:1.22;margin:0 0 14px;color:var(--navy);font-weight:700;padding-bottom:6px;border-bottom:2px solid var(--gold);display:block;}
.fpres p{margin:0 0 12px;color:var(--ink-soft);max-width:64ch;} .fpres p:last-child{margin-bottom:0;}
.fpres strong{color:var(--ink);font-weight:600;}
.fpres .lead{font-size:17px;color:var(--ink-soft);}
.fpres .eyebrow{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--navy);}
.fpres .kicker{font-size:12.5px;color:var(--ink-mute);margin-top:10px;}
.fpres .num{font-variant-numeric:tabular-nums;}
.fpres .brandbar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:20px 0 16px;border-bottom:3px solid var(--navy);}
.fpres .brandbar .eceb{font-weight:800;color:var(--navy);font-size:16px;letter-spacing:.01em;}
.fpres .brandbar .brandfor{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-mute);white-space:nowrap;}
.fpres .brandbar .client{font-weight:700;color:var(--ink);font-size:15px;}
.fpres .modetag{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--navy);background:var(--gold-soft);border:1px solid var(--gold);border-radius:6px;padding:7px 12px;margin-top:15px;}
.fpres .modetag .d{width:6px;height:6px;border-radius:999px;background:var(--gold);}
.fpres .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin:20px 0 2px;}
.fpres .kpi{background:var(--navy);border-radius:8px;padding:16px 12px;text-align:center;box-shadow:var(--shadow);}
.fpres .kpi .n{font-size:27px;font-weight:700;color:var(--gold);line-height:1;font-variant-numeric:tabular-nums;transition:color .3s;}
.fpres .kpi .l{font-size:11px;color:#cfe0f0;margin-top:7px;line-height:1.35;}
.fpres .kpi.lite{background:var(--panel);border:1px solid var(--line);} .fpres .kpi.lite .n{color:var(--navy);} .fpres .kpi.lite .l{color:var(--ink-mute);}
@media(max-width:520px){.fpres .kpis{grid-template-columns:1fr 1fr;}}
.fpres details.detail{margin-top:14px;border:1px solid var(--line);border-radius:8px;background:var(--panel);overflow:hidden;}
.fpres details.detail>summary{list-style:none;cursor:pointer;padding:10px 14px;font-size:13px;font-weight:600;color:var(--navy);display:flex;align-items:center;gap:9px;user-select:none;}
.fpres details.detail>summary::-webkit-details-marker{display:none;}
.fpres .detail>summary .chev{transition:transform .18s;color:var(--gold);}
.fpres .detail[open]>summary .chev{transform:rotate(90deg);}
.fpres .detail>summary:hover{background:var(--panel-2);}
.fpres .detail .body{padding:2px 15px 15px;font-size:14px;color:var(--ink-soft);}
.fpres .detail .body p{font-size:14px;margin-bottom:9px;} .fpres .detail .src{margin-top:9px;font-size:11.5px;color:var(--ink-mute);}
.fpres table.mini{width:100%;border-collapse:collapse;font-size:13px;margin:6px 0 2px;}
.fpres table.mini th{text-align:left;font-size:11px;color:#fff;background:var(--navy);font-weight:600;padding:6px 9px;}
.fpres table.mini th.r{text-align:right;} .fpres table.mini td{padding:6px 9px;border-bottom:1px solid var(--line-2);}
.fpres table.mini td.n{text-align:right;font-variant-numeric:tabular-nums;} .fpres table.mini tr:last-child td{border-bottom:0;}
.fpres table.mini tr.tot td{font-weight:700;color:var(--ink);background:var(--panel-2);}
.fpres .hot{color:var(--hot);font-weight:700;} .fpres .cool{color:var(--good);font-weight:700;}
.fpres .panel{background:var(--ground);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);overflow:hidden;margin-top:6px;}
.fpres .gauge{padding:19px;background:var(--panel);border-bottom:1px solid var(--line);}
.fpres .gauge .glabel{font-size:11.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-mute);}
.fpres .gauge .grow{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:8px;}
.fpres .gauge .gbig{font-size:clamp(30px,6vw,40px);font-weight:700;line-height:1;color:var(--navy);font-variant-numeric:tabular-nums;transition:color .3s;}
.fpres .gauge .gunit{font-size:13.5px;color:var(--ink-mute);}
.fpres .pill{font-size:12px;font-weight:700;border-radius:5px;padding:5px 11px;margin-left:auto;transition:background .3s,color .3s;}
.fpres .gtrack{position:relative;height:12px;border-radius:5px;background:var(--panel-2);margin-top:15px;overflow:hidden;border:1px solid var(--line);}
.fpres .gfill{height:100%;border-radius:4px;transition:width .5s cubic-bezier(.4,0,.2,1),background .3s;}
.fpres .gmark{position:absolute;top:-4px;bottom:-4px;width:2px;} .fpres .gmark.t{background:var(--good);} .fpres .gmark.now{background:var(--hot);}
.fpres .gmarklab{font-size:11px;color:var(--ink-mute);margin-top:8px;}
.fpres .removed{padding:11px 19px;font-size:13.5px;color:var(--ink-soft);border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:12px;align-items:center;}
.fpres .removed .rv{font-size:17px;font-weight:700;color:var(--good);font-variant-numeric:tabular-nums;transition:opacity .3s;}
.fpres .lever{display:flex;gap:13px;padding:12px 19px;border-bottom:1px solid var(--line-2);align-items:flex-start;}
.fpres .lever:last-child{border-bottom:0;}
.fpres .sw{flex:none;width:40px;height:23px;border-radius:4px;background:var(--good);position:relative;margin-top:2px;}
.fpres .sw::after{content:"";position:absolute;top:2px;left:2px;width:19px;height:19px;border-radius:3px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transform:translateX(17px);}
.fpres .sw.off{background:#c3ceda;} .fpres .sw.off::after{transform:translateX(0);}
.fpres .lbody{display:flex;flex-direction:column;} .fpres .lbody .lt{font-weight:600;color:var(--ink);font-size:14.5px;}
.fpres .lbody .ld{font-size:13px;color:var(--ink-soft);margin-top:3px;} .fpres .lbody .lsave{font-size:12.5px;font-weight:700;color:var(--good);margin-top:5px;font-variant-numeric:tabular-nums;}
.fpres .keymsg{margin-top:15px;background:var(--gold-soft);border:1px solid var(--gold);border-radius:8px;padding:14px 16px;}
.fpres .keymsg p{color:var(--navy);font-size:14.5px;margin:0;font-weight:500;}
.fpres .pbar{display:grid;gap:13px;margin:18px 0 4px;}
.fpres .prow .ptop{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:6px;}
.fpres .prow .plabel{font-size:13px;color:var(--ink-soft);} .fpres .prow .pval{font-size:18px;font-weight:700;font-variant-numeric:tabular-nums;} .fpres .prow .pval .u{font-size:12px;font-weight:600;color:var(--ink-mute);margin-left:3px;}
.fpres .prow .track{height:13px;border-radius:5px;background:var(--panel-2);overflow:hidden;border:1px solid var(--line);} .fpres .prow .fill{height:100%;border-radius:5px;transition:width .5s cubic-bezier(.4,0,.2,1);}
.fpres table.act{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:8px;}
.fpres table.act th{text-align:left;font-size:11px;color:#fff;background:var(--navy);font-weight:600;padding:7px 10px;}
.fpres table.act td{padding:9px 10px;border-bottom:1px solid var(--line-2);vertical-align:top;color:var(--ink-soft);}
.fpres table.act tr:nth-child(even) td{background:var(--panel);}
.fpres table.act td.when{white-space:nowrap;font-size:12px;color:var(--navy);font-weight:700;}
.fpres .reco{background:var(--navy);border-radius:10px;padding:20px 22px;box-shadow:var(--shadow);margin-top:6px;}
.fpres .reco h2{color:#fff;border-bottom-color:var(--gold);margin-bottom:9px;} .fpres .reco p{color:#e6eef6;}
.fpres .next{margin-top:13px;font-size:14.5px;color:#cfe0f0;display:flex;gap:10px;align-items:flex-start;}
.fpres .next .dot{flex:none;width:7px;height:7px;border-radius:999px;background:var(--gold);margin-top:8px;} .fpres .next strong{color:#fff;}
.fpres footer{margin-top:34px;padding-top:18px;border-top:2px solid var(--navy);} .fpres footer p{font-size:12px;color:var(--ink-mute);line-height:1.5;} .fpres .sig{font-weight:700;color:var(--navy);}
@media(prefers-reduced-motion:reduce){.fpres *{transition:none!important;}}
`;

const Chev = () => (
  <svg className="chev" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M6 4l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function FigureDetail({
  summary,
  detail,
  figures,
  src,
}: {
  summary: string;
  detail?: string;
  figures?: Figure[];
  src?: string;
}) {
  if (!detail && !(figures && figures.length)) return null;
  return (
    <details className="detail">
      <summary>
        <Chev />
        {summary}
      </summary>
      <div className="body">
        {detail && <p>{detail}</p>}
        {figures && figures.length > 0 && (
          <table className="mini">
            <tbody>
              {figures.map((f, i) => (
                <tr key={i}>
                  <td>{f.label}</td>
                  <td className="n">{f.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {src && <p className="src">{src}</p>}
      </div>
    </details>
  );
}

export function PresentationDoc({ data, clientName }: { data: any; clientName?: string }) {
  const review = data?.review || null;
  const proj = data?.projection || null;
  const emp = data?.employer || null;
  const h = review?.headline || null;
  const client = clientName || emp?.name || h?.carrier || "Your organization";
  const carrier = h?.carrier || emp?.carrier || "";

  // Renewal outlook (always unit-safe; premium, not loss ratio) --------------
  const paths = proj?.paths || null;
  const cur = typeof paths?.currentAnnual === "number" ? paths.currentAnnual : null;
  const sq = paths?.statusQuo || null;
  const wl = paths?.withLevers || null;
  const cap = paths?.capped || null;
  // Optional loss-ratio trio if the engine feeds it (percent units, e.g. 167).
  const lr = proj?.lossRatio && typeof proj.lossRatio === "object" ? proj.lossRatio : null;

  const kpiLR = lr && typeof lr.current === "number";
  // Gauge: prefer loss ratio when present, else renewal % (statusQuo is the hot ceiling).
  const gauge = kpiLR
    ? {
        big: `${plainPct(lr.current)}`,
        unit: "loss ratio today",
        withVal: typeof lr.withLevers === "number" ? lr.withLevers : lr.current,
        worst: Math.max(lr.current, typeof lr.withLevers === "number" ? lr.withLevers : 0),
        target: typeof lr.target === "number" ? lr.target : null,
      }
    : sq && typeof sq.changePct === "number"
      ? {
          big: pctTxt(wl?.changePct ?? sq.changePct),
          unit: "renewal, with the changes on screen",
          withVal: wl?.changePct ?? sq.changePct,
          worst: sq.changePct,
          target: cap?.changePct ?? 0,
        }
      : null;

  const removedTotal = typeof wl?.totalClaimsSaved === "number" ? wl.totalClaimsSaved : null;
  const perLever: any[] = Array.isArray(proj?.perLever) ? proj.perLever : [];

  const disclaimers: string[] = Array.isArray(review?.disclaimers) ? review.disclaimers : [];
  const roadmapItems: any[] = Array.isArray(review?.roadmap?.items) ? review.roadmap.items : [];
  const diagnosis: any[] = Array.isArray(review?.diagnosis) ? review.diagnosis : [];
  const drivers: any[] = Array.isArray(review?.drivers) ? review.drivers : [];
  const lossRatios: any[] = Array.isArray(review?.lossRatios) ? review.lossRatios : [];
  const recoText =
    diagnosis
      .map((d: any) => (typeof d === "string" ? d : d?.plain))
      .filter(Boolean)
      .slice(0, 2)
      .join(" ") ||
    (Array.isArray(review?.scenarios) && review.scenarios[0]?.body) ||
    "";

  // The gauge fill position (0..100) and target/now marks, on a 0..worst scale.
  const gaugePos = (v: number) =>
    gauge && gauge.worst ? Math.min(100, Math.max(2, (v / gauge.worst) * 100)) : 50;

  if (!review && !proj) return null;

  return (
    <div className="fpres">
      <style>{CSS}</style>
      <main className="doc">
        <div className="brandbar">
          <span className="eceb">East Coast Employee Benefits</span>
          <span className="brandfor">Prepared for</span>
          <span className="client">{client}</span>
        </div>

        <header style={{ marginTop: 22 } as CSSProperties}>
          <div className="eyebrow">
            {h?.experienceWindow ? "Renewal review" : "Benefits review"}
            {carrier ? ` · ${carrier}` : ""}
          </div>
          <h1>Where your plan stands, and the plan to shape what is next</h1>
          <p className="kicker">
            {client}
            {h?.effective ? ` · renewal effective ${h.effective}` : ""}
            {typeof h?.lives === "number" ? ` · ${h.lives} lives` : ""}. Every figure opens for the
            detail behind it.
          </p>
        </header>

        {/* WHERE THINGS STAND -------------------------------------------------- */}
        {gauge && (
          <section>
            <h2>Where things stand</h2>
            <div className="kpis">
              {kpiLR ? (
                <>
                  <div className="kpi">
                    <div className="n num">{plainPct(lr.current)}</div>
                    <div className="l">claims vs premium today</div>
                  </div>
                  <div className="kpi lite">
                    <div className="n num">
                      {typeof lr.withLevers === "number" ? plainPct(lr.withLevers) : "—"}
                    </div>
                    <div className="l">where the plan below takes you</div>
                  </div>
                  <div className="kpi lite">
                    <div className="n num">
                      {typeof lr.target === "number" ? plainPct(lr.target) : "—"}
                    </div>
                    <div className="l">a healthy, well-priced plan</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="kpi">
                    <div className="n num">{pctTxt(sq?.changePct)}</div>
                    <div className="l">renewal if nothing changes</div>
                  </div>
                  <div className="kpi lite">
                    <div className="n num">{pctTxt(wl?.changePct)}</div>
                    <div className="l">with the changes on screen</div>
                  </div>
                  <div className="kpi lite">
                    <div className="n num">{removedTotal ? money0(removedTotal) : "—"}</div>
                    <div className="l">claims trimmed per year</div>
                  </div>
                </>
              )}
            </div>
            {lossRatios.length > 0 && (
              <details className="detail">
                <summary>
                  <Chev />
                  Show the numbers behind it
                </summary>
                <div className="body">
                  <table className="mini">
                    <thead>
                      <tr>
                        <th>Benefit</th>
                        <th className="r">Claims vs premium</th>
                        <th className="r">Rate change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lossRatios.map((r: any, i: number) => (
                        <tr key={i}>
                          <td>{r.benefit}</td>
                          <td className="n hot">{plainPct(r.lossRatio)}</td>
                          <td className="n">{pctTxt(r.rateChangePct)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="src">Source: your carrier claims experience.</p>
                </div>
              </details>
            )}
          </section>
        )}

        {/* WHAT IS DRIVING IT ------------------------------------------------- */}
        {drivers.length > 0 && (
          <section>
            <h2>What is driving it</h2>
            {drivers.map((d: any, i: number) => (
              <div key={i} style={{ marginBottom: 8 } as CSSProperties}>
                <p>
                  <strong>{d.title}</strong>
                  {d.body ? ` ${d.body}` : ""}
                </p>
                <FigureDetail
                  summary="Where this comes from"
                  detail={d.detail}
                  figures={figuresOf(d)}
                />
              </div>
            ))}
          </section>
        )}

        {/* THE PLAN — LIVE GAUGE + APPLIED LEVERS ----------------------------- */}
        {(gauge || perLever.length > 0) && (
          <section>
            <h2>The plan, live</h2>
            <p>
              As your advisor switches the pieces on and off, this settles in real time. Nothing
              here changes anyone&apos;s care. It changes what the plan pays for the same care.
            </p>
            <div className="panel">
              {gauge && (
                <div className="gauge">
                  <div className="glabel">{gauge.unit}</div>
                  <div className="grow">
                    <span className="gbig num">
                      {kpiLR ? plainPct(gauge.withVal) : pctTxt(gauge.withVal)}
                    </span>
                    <span className="gunit">
                      {kpiLR
                        ? "claims per $1 of premium, with the plan"
                        : "with the plan on screen"}
                    </span>
                    <span
                      className="pill"
                      style={
                        { background: "var(--good-soft)", color: "var(--good)" } as CSSProperties
                      }
                    >
                      {wl ? "Improving" : "Live"}
                    </span>
                  </div>
                  <div className="gtrack">
                    <div
                      className="gfill"
                      style={
                        {
                          width: `${gaugePos(gauge.withVal)}%`,
                          background: "var(--navy)",
                        } as CSSProperties
                      }
                    />
                    {gauge.target != null && (
                      <div
                        className="gmark t"
                        style={{ left: `${gaugePos(gauge.target)}%` } as CSSProperties}
                      />
                    )}
                    <div
                      className="gmark now"
                      style={{ left: `${gaugePos(gauge.worst)}%` } as CSSProperties}
                    />
                  </div>
                  <div className="gmarklab">
                    Green mark is a healthy target. Red mark is where you land untouched. The plan
                    moves you left.
                  </div>
                </div>
              )}
              {removedTotal != null && (
                <div className="removed">
                  <span>Claims taken out of the rated window, per year</span>
                  <span className="rv num">{money0(removedTotal)} / yr</span>
                </div>
              )}
              {perLever.map((l: any, i: number) => (
                <div className="lever" key={i}>
                  <span className="sw" />
                  <span className="lbody">
                    <span className="lt">{l.name}</span>
                    {typeof l.claimsSaved === "number" && (
                      <span className="lsave">removes ~{money0(l.claimsSaved)} / yr</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className="keymsg">
              <p>
                Your coverage is unchanged. We handle the carrier, the coordination, and a
                privacy-safe note to your team. No one at {client} has to speak to an employee about
                their care.
              </p>
            </div>
          </section>
        )}

        {/* THE OUTLOOK — projection bars ------------------------------------- */}
        {paths && typeof cur === "number" && sq && (
          <section>
            <h2>Where the renewal lands</h2>
            <div className="pbar">
              <div className="prow">
                <div className="ptop">
                  <span className="plabel">Current premium</span>
                  <span className="pval num">
                    {money0(cur)}
                    <span className="u">/yr</span>
                  </span>
                </div>
                <div className="track">
                  <div
                    className="fill"
                    style={{ width: "62%", background: "var(--ink-mute)" } as CSSProperties}
                  />
                </div>
              </div>
              <div className="prow">
                <div className="ptop">
                  <span className="plabel">If nothing changes {pctTxt(sq.changePct)}</span>
                  <span className="pval num" style={{ color: "var(--hot)" } as CSSProperties}>
                    {money0(sq.annual)}
                    <span className="u">/yr</span>
                  </span>
                </div>
                <div className="track">
                  <div
                    className="fill"
                    style={{ width: "100%", background: "var(--hot)" } as CSSProperties}
                  />
                </div>
              </div>
              {cap && typeof cap.annual === "number" && (
                <div className="prow">
                  <div className="ptop">
                    <span className="plabel">First-renewal cap {pctTxt(cap.changePct)}</span>
                    <span className="pval num" style={{ color: "var(--warn)" } as CSSProperties}>
                      {money0(cap.annual)}
                      <span className="u">/yr</span>
                    </span>
                  </div>
                  <div className="track">
                    <div
                      className="fill"
                      style={
                        {
                          width: `${Math.min(100, (cap.annual / sq.annual) * 100)}%`,
                          background: "var(--warn)",
                        } as CSSProperties
                      }
                    />
                  </div>
                </div>
              )}
              {wl && typeof wl.annual === "number" && (
                <div className="prow">
                  <div className="ptop">
                    <span className="plabel">
                      With the changes on screen {pctTxt(wl.changePct)}
                    </span>
                    <span className="pval num" style={{ color: "var(--good)" } as CSSProperties}>
                      {money0(wl.annual)}
                      <span className="u">/yr</span>
                    </span>
                  </div>
                  <div className="track">
                    <div
                      className="fill"
                      style={
                        {
                          width: `${Math.min(100, (wl.annual / sq.annual) * 100)}%`,
                          background: "var(--good)",
                        } as CSSProperties
                      }
                    />
                  </div>
                </div>
              )}
            </div>
            <p className="kicker" style={{ marginTop: 12 } as CSSProperties}>
              Modelled from your plan&apos;s experience with stated assumptions. An estimate to
              steer by, not a quote; your carrier confirms final rates.
            </p>
          </section>
        )}

        {/* WHAT WE NEED FROM YOU — action table ------------------------------ */}
        {roadmapItems.length > 0 && (
          <section>
            <h2>The steps from here</h2>
            <table className="act">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {roadmapItems.map((it: any, i: number) => (
                  <tr key={i}>
                    <td>
                      <strong>{it.title}</strong>
                      {it.body ? (
                        <div style={{ marginTop: 3 } as CSSProperties}>{it.body}</div>
                      ) : null}
                    </td>
                    <td className="when">{it.due || it.badge || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* RECOMMENDATION ---------------------------------------------------- */}
        {recoText && (
          <section>
            <div className="reco">
              <h2>Our recommendation</h2>
              <p>{recoText}</p>
              <div className="next">
                <span className="dot" />
                <span>
                  <strong>Next step:</strong> a short call to green-light the plan and assign
                  owners.
                </span>
              </div>
            </div>
          </section>
        )}

        <footer>
          <p className="sig">Prepared by East Coast Employee Benefits</p>
          <p>
            {disclaimers.length > 0
              ? disclaimers.join(" ")
              : "Drawn from your plan's claims experience. Savings are estimates against your most recent claims and are confirmed at amendment by your carrier; the renewal depends on the insurer. Your coverage is unchanged except where a cost-share shift is paired with an offsetting top-up as noted."}
          </p>
        </footer>
      </main>
    </div>
  );
}
