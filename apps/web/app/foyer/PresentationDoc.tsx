"use client";
// The client-facing PRESENTATION — the warm-paper renewal document the broker
// presents in the room. Driven by the LIVE presented payload (review + projection):
// when the broker toggles a lever in the office tab, the projection snapshot changes
// and every figure here count-tweens to its new value in one calm pass.
//
// READ-ONLY by design: the client never toggles anything and this never does its
// own loss-ratio math (that would risk mixing premium/experience bases). It renders
// exactly what the engine sent. Loss-ratio values arrive in PERCENT UNITS
// (326.71 means 326.71%); overallLossRatio is the one fraction and is not used here.
// This component must never crash on a partial payload: every field is optional.
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// Formatting (unchanged data contract: render what arrives, no arithmetic on
// experience bases; the only derivation permitted is annualizing the carrier's
// own renewal letter figure).
// ---------------------------------------------------------------------------
const money0 = (n: any): string =>
  typeof n === "number" && Number.isFinite(n) ? "$" + Math.round(n).toLocaleString("en-CA") : "—";
const pctTxt = (p: any, dp = 1): string =>
  typeof p === "number" && Number.isFinite(p) ? `${p > 0 ? "+" : ""}${p.toFixed(dp)}%` : "—";
const plainPct = (p: any, dp = 0): string =>
  typeof p === "number" && Number.isFinite(p) ? `${p.toFixed(dp)}%` : "—";

type Figure = { label: string; value: string };
const figuresOf = (x: any): Figure[] =>
  Array.isArray(x?.figures)
    ? x.figures
        .map((f: any) => ({ label: String(f?.label ?? ""), value: String(f?.value ?? "") }))
        .filter((f: Figure) => f.label || f.value)
    : [];

// ---------------------------------------------------------------------------
// The one easing. cubic-bezier(0.22, 0.61, 0.36, 1) — evaluated in JS for the
// count-tween so numbers settle exactly like the bars do. Standard bezier solve.
// ---------------------------------------------------------------------------
const EASE = "cubic-bezier(0.22,0.61,0.36,1)";
function makeBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solveT = (x: number) => {
    let t = x;
    for (let i = 0; i < 6; i++) {
      const err = sampleX(t) - x;
      const d = sampleDX(t);
      if (Math.abs(err) < 1e-5 || d === 0) break;
      t -= err / d;
    }
    return Math.min(1, Math.max(0, t));
  };
  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solveT(x)));
}
const easeFn = makeBezier(0.22, 0.61, 0.36, 1);

// ---------------------------------------------------------------------------
// useCountTween — numbers glide to new values (requestAnimationFrame, eased on
// the token, no overshoot, no odometer flips; tabular figures keep the layout
// still). SSR-safe: first render is the raw value, no animation. Respects
// prefers-reduced-motion.
// ---------------------------------------------------------------------------
function useCountTween(target: number | null | undefined, duration = 380): number | null {
  const t = typeof target === "number" && Number.isFinite(target) ? target : null;
  const [val, setVal] = useState<number | null>(t);
  const shownRef = useRef<number | null>(t);
  useEffect(() => {
    const from = shownRef.current;
    if (t == null || from == null || from === t) {
      shownRef.current = t;
      setVal(t);
      return;
    }
    if (
      typeof window === "undefined" ||
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
      shownRef.current = t;
      setVal(t);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const v = from + (t - from) * easeFn(p);
      shownRef.current = v;
      setVal(v);
      if (p < 1) raf = requestAnimationFrame(step);
      else {
        shownRef.current = t;
        setVal(t);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [t, duration]);
  return val;
}

// Tiny render helpers so hooks live at a component boundary (safe inside maps).
function TweenMoney({ value, style }: { value: number | null; style?: CSSProperties }) {
  const v = useCountTween(value);
  return (
    <span className="num" style={style}>
      {money0(v)}
    </span>
  );
}
function TweenPct({
  value,
  dp = 1,
  signed = true,
  style,
}: {
  value: number | null;
  dp?: number;
  signed?: boolean;
  style?: CSSProperties;
}) {
  const v = useCountTween(value);
  return (
    <span className="num" style={style}>
      {signed ? pctTxt(v, dp) : plainPct(v, dp)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// The document CSS, scoped under .fdoc so nothing leaks into the room chrome.
// Warm paper, hairline rules, serif figures, gold used once per surface.
// ---------------------------------------------------------------------------
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.02'/%3E%3C/svg%3E\")";

const CSS = `
.fdoc{
  --paper:#F7F4EC; --ink:#10233F;
  --ink-soft:rgba(16,35,63,.78); --ink-mute:rgba(16,35,63,.56); --ink-faint:rgba(16,35,63,.38);
  --hair:rgba(16,35,63,.16); --hair-soft:rgba(16,35,63,.09);
  --gold:#C6A15B; --gold-hi:#D9B878;
  --hot:#B54A44; --warn:#C99B3F; --good:#3E7D5C;
  --ease:${EASE};
  --serif:'Iowan Old Style','Palatino Linotype','Book Antiqua',Cambria,Georgia,'Times New Roman',serif;
  --sans:'Segoe UI',Inter,system-ui,-apple-system,sans-serif;
  background:var(--paper);
  background-image:${GRAIN};
  color:var(--ink);
  font-family:var(--sans);
  font-size:15.5px; line-height:1.6;
  border-radius:4px;
  box-shadow:0 1px 2px rgba(10,29,53,.18), 0 14px 44px rgba(10,29,53,.30);
  -webkit-font-smoothing:antialiased;
}
.fdoc *{box-sizing:border-box;}
.fdoc .page{max-width:860px;margin:0 auto;padding:52px 56px 44px;}
@media(max-width:640px){.fdoc .page{padding:34px 22px 32px;}}
.fdoc .num{font-family:var(--serif);font-variant-numeric:tabular-nums lining-nums;}
.fdoc .kick{font-family:var(--sans);font-size:10.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-mute);}
/* ECEB wordmark rendered in the doc's ink via a CSS mask (the only shipped asset
   is a white logo; masking a navy fill by its alpha gives an exact-color mark on
   paper with no separate dark asset). */
.fdoc .eceb-mark{width:154px;height:57px;background:var(--ink);-webkit-mask:url(/brand/eceb-logo-white.png) left center / contain no-repeat;mask:url(/brand/eceb-logo-white.png) left center / contain no-repeat;}
.fdoc footer .eceb-mark-sm{width:112px;height:42px;background:var(--ink-mute);-webkit-mask:url(/brand/eceb-logo-white.png) center / contain no-repeat;mask:url(/brand/eceb-logo-white.png) center / contain no-repeat;margin:2px auto 8px;}
.fdoc h1{font-family:var(--serif);font-weight:400;font-size:clamp(29px,4.6vw,43px);line-height:1.1;letter-spacing:-.012em;margin:12px 0 0;color:var(--ink)!important;}
.fdoc h2,.fdoc h3,.fdoc h4{color:var(--ink)!important;}
.fdoc .subline{font-size:13px;color:var(--ink-mute);margin-top:10px;font-variant-numeric:tabular-nums lining-nums;}
.fdoc .rule{border:0;border-top:1px solid var(--hair);margin:0;}
.fdoc .rule.soft{border-top-color:var(--hair-soft);}
.fdoc .anchor-rule{display:flex;align-items:center;gap:14px;margin-top:26px;}
.fdoc .anchor-rule::before,.fdoc .anchor-rule::after{content:"";flex:1;border-top:1px solid var(--hair);box-shadow:0 1px 0 rgba(255,255,255,.65);}
.fdoc section{margin-top:44px;}
.fdoc .seckick{display:flex;align-items:baseline;gap:14px;margin-bottom:18px;}
.fdoc .seckick .kick{white-space:nowrap;}
.fdoc .seckick::after{content:"";flex:1;border-top:1px solid var(--hair-soft);align-self:center;}
.fdoc p{margin:0 0 12px;color:var(--ink-soft);max-width:66ch;}
.fdoc p:last-child{margin-bottom:0;}
.fdoc strong{color:var(--ink)!important;font-weight:600;}

/* THE RECONCILIATION ------------------------------------------------------ */
.fdoc .recon{display:grid;grid-template-columns:1fr 1fr 1fr;}
.fdoc .recon.two{grid-template-columns:1fr 1fr;}
.fdoc .recon .col{padding:6px 26px 10px 0;}
.fdoc .recon .col + .col{border-left:1px solid var(--hair);padding-left:26px;}
@media(max-width:640px){
  .fdoc .recon,.fdoc .recon.two{grid-template-columns:1fr;}
  .fdoc .recon .col + .col{border-left:0;border-top:1px solid var(--hair);padding-left:0;padding-top:16px;margin-top:14px;}
}
.fdoc .recon .clabel{font-family:var(--sans);font-size:10.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-mute);}
.fdoc .recon .cfig{font-family:var(--serif);font-size:clamp(26px,3.6vw,34px);line-height:1.05;margin-top:10px;font-variant-numeric:tabular-nums lining-nums;}
.fdoc .recon .cfig.ask{color:var(--ink);font-weight:700;}
.fdoc .recon .cfig.support{font-weight:400;background:linear-gradient(180deg,#D9B878,#C6A15B 55%,#A8853F);-webkit-background-clip:text;background-clip:text;color:transparent;}
.fdoc .recon .csub{font-size:12px;color:var(--ink-mute);margin-top:8px;line-height:1.45;font-variant-numeric:tabular-nums lining-nums;}
.fdoc .recon .cverd{font-family:var(--sans);font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;}
.fdoc .recon .quiet{font-family:var(--serif);font-size:16px;font-style:italic;color:var(--ink-mute);margin-top:14px;}

/* THE READING ------------------------------------------------------------- */
.fdoc .reading .rfig{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;}
.fdoc .reading .rbig{font-family:var(--serif);font-size:clamp(30px,4.4vw,40px);line-height:1;font-variant-numeric:tabular-nums lining-nums;}
.fdoc .reading .runit{font-size:12.5px;color:var(--ink-mute);}
.fdoc .rtrack{position:relative;height:34px;margin-top:20px;border-bottom:1px solid var(--hair);}
.fdoc .rneedle{position:absolute;top:4px;bottom:-1px;width:1.5px;transition:left 380ms var(--ease);}
.fdoc .rneedle.second{top:14px;opacity:.55;}
.fdoc .rtick{position:absolute;top:0;bottom:-1px;width:2px;background:linear-gradient(180deg,#D9B878,#C6A15B 55%,#A8853F);transition:left 380ms var(--ease);}
.fdoc .rlegend{display:flex;gap:22px;flex-wrap:wrap;margin-top:12px;font-size:12px;color:var(--ink-mute);font-variant-numeric:tabular-nums lining-nums;}
.fdoc .rlegend .sw{display:inline-block;width:10px;height:2px;vertical-align:middle;margin-right:7px;position:relative;top:-2px;}

/* DEPLOYABLES (derivation ledgers) ---------------------------------------- */
.fdoc .dep{margin-top:10px;}
.fdoc .depsum{display:inline-flex;align-items:center;gap:8px;background:none;border:0;padding:2px 0;margin:0;cursor:pointer;font-family:var(--sans);font-size:12px;font-weight:600;letter-spacing:.04em;color:var(--ink-mute);}
.fdoc .depsum:hover{color:var(--ink);}
.fdoc .depsum .chev{transition:transform 260ms var(--ease);color:var(--ink-faint);flex:none;}
.fdoc .depsum.open .chev{transform:rotate(90deg);}
.fdoc .depbody{overflow:hidden;transition:max-height 380ms var(--ease);}
.fdoc table.ledger{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px;}
.fdoc table.ledger td,.fdoc table.ledger th{padding:7px 2px;border-bottom:1px solid var(--hair-soft);text-align:left;color:var(--ink-soft);}
.fdoc table.ledger th{font-family:var(--sans);font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-mute);border-bottom:1px solid var(--hair);}
.fdoc table.ledger td.n,.fdoc table.ledger th.n{text-align:right;font-family:var(--serif);font-variant-numeric:tabular-nums lining-nums;color:var(--ink);}
.fdoc table.ledger tr:last-child td{border-bottom:0;}
.fdoc .depsrc{font-size:11px;color:var(--ink-faint);margin-top:8px;}

/* DRIVERS ------------------------------------------------------------------ */
.fdoc .driver{padding:14px 0;border-top:1px solid var(--hair-soft);}
.fdoc .driver:first-of-type{border-top:0;padding-top:0;}

/* ADJUSTMENTS + OUTLOOK ---------------------------------------------------- */
.fdoc .ledgerrow{display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:10px 0;border-top:1px solid var(--hair-soft);}
.fdoc .ledgerrow:first-of-type{border-top:0;}
.fdoc .ledgerrow .lname{color:var(--ink);font-size:14px;}
.fdoc .ledgerrow .limpact{display:block;font-size:11.5px;color:var(--ink-mute);margin-top:2px;}
.fdoc .ledgerrow .lval{font-family:var(--serif);font-size:16px;white-space:nowrap;color:var(--ink);font-variant-numeric:tabular-nums lining-nums;}
.fdoc .obar{margin-top:16px;}
.fdoc .obar .otop{display:flex;justify-content:space-between;align-items:baseline;gap:14px;margin-bottom:6px;}
.fdoc .obar .olabel{font-size:12.5px;color:var(--ink-soft);}
.fdoc .obar .olabel .osub{color:var(--ink-faint);font-size:11px;margin-left:8px;font-variant-numeric:tabular-nums lining-nums;}
.fdoc .obar .oval{font-family:var(--serif);font-size:17px;white-space:nowrap;font-variant-numeric:tabular-nums lining-nums;}
.fdoc .obar .otrack{position:relative;height:5px;border-bottom:1px solid var(--hair-soft);}
.fdoc .obar .ofill{position:absolute;left:0;top:2px;height:1.5px;transition:width 380ms var(--ease);}

/* ROADMAP ------------------------------------------------------------------ */
.fdoc .steps{display:grid;grid-template-columns:1fr 1fr;gap:0 44px;}
@media(max-width:640px){.fdoc .steps{grid-template-columns:1fr;}}
.fdoc .step{padding:13px 0;border-top:1px solid var(--hair-soft);}
.fdoc .step .swhen{font-family:var(--sans);font-size:10.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mute);}
.fdoc .step .stitle{color:var(--ink);font-weight:600;font-size:14px;margin-top:3px;}
.fdoc .step .sbody{font-size:13px;color:var(--ink-soft);margin-top:3px;}

/* RECOMMENDATION + FOOTER --------------------------------------------------- */
.fdoc .reco{font-family:var(--serif);font-size:18px;line-height:1.65;color:var(--ink);max-width:62ch;}
.fdoc footer{margin-top:52px;}
.fdoc footer .fine{font-size:11px;color:var(--ink-mute);line-height:1.6;margin-top:14px;max-width:none;}
.fdoc footer .sig{font-size:12px;color:var(--ink-soft);margin-top:14px;}
.fdoc footer .anchor{display:flex;justify-content:center;margin-top:22px;color:var(--ink-faint);}
@media(prefers-reduced-motion:reduce){.fdoc *{transition:none!important;}}
`;

const Chev = () => (
  <svg className="chev" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M6 4l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Anchor = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M12 7.4V20M12 20c-4.4 0-7.4-3-8-6.4l2.2 1.2M12 20c4.4 0 7.4-3 8-6.4l-2.2 1.2M8.6 10.6h6.8"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// A plain statement that opens in place to the derivation behind it: hairline
// ledger, serif numbers right-aligned, source line in small muted text.
function Deployable({
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
  const [open, setOpen] = useState(false);
  if (!detail && !(figures && figures.length)) return null;
  return (
    <div className="dep">
      <button
        type="button"
        className={`depsum${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Chev />
        {summary}
      </button>
      <div
        className="depbody"
        style={{ maxHeight: open ? "70vh" : 0, opacity: open ? 1 : 0 } as CSSProperties}
        aria-hidden={!open}
      >
        {detail && (
          <p style={{ fontSize: 13, marginTop: 8, marginBottom: 0 } as CSSProperties}>{detail}</p>
        )}
        {figures && figures.length > 0 && (
          <table className="ledger">
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
        {src && <div className="depsrc">{src}</div>}
      </div>
    </div>
  );
}

// One outlook bar: thin hairline mark, serif figure count-tweening, width easing.
function OutlookBar({
  label,
  sub,
  annual,
  pct,
  color,
  max,
}: {
  label: string;
  sub?: string | null;
  annual: number;
  pct: number | null;
  color: string;
  max: number;
}) {
  const width = max > 0 ? Math.min(100, Math.max(2, (annual / max) * 100)) : 2;
  return (
    <div className="obar">
      <div className="otop">
        <span className="olabel">
          {label}
          {sub ? <span className="osub">{sub}</span> : null}
        </span>
        <span className="oval" style={{ color } as CSSProperties}>
          <TweenMoney value={annual} />
          {pct != null && (
            <span
              style={{ fontSize: 12, marginLeft: 8, color: "var(--ink-mute)" } as CSSProperties}
            >
              <TweenPct value={pct} />
            </span>
          )}
        </span>
      </div>
      <div className="otrack">
        <div className="ofill" style={{ width: `${width}%`, background: color } as CSSProperties} />
      </div>
    </div>
  );
}

const SectionKick = ({ children }: { children: ReactNode }) => (
  <div className="seckick">
    <span className="kick">{children}</span>
  </div>
);

export function PresentationDoc({ data, clientName }: { data: any; clientName?: string }) {
  const review = data?.review || null;
  const proj = data?.projection || null;
  const emp = data?.employer || null;
  const h = review?.headline || null;
  const client = clientName || emp?.name || h?.carrier || "Your organization";
  const carrier = h?.carrier || emp?.carrier || "";

  // ---- THE RECONCILIATION inputs -----------------------------------------
  // The carrier's ask, annualized straight from the renewal letter: monthlyTo
  // when present, else derived from monthlyFrom and the letter's own pct. This
  // is the only derivation in the file and it stays inside the carrier's own
  // stated figures.
  const askAnnual: number | null =
    typeof h?.monthlyTo === "number"
      ? h.monthlyTo * 12
      : typeof h?.monthlyFrom === "number" && typeof h?.pct === "number"
        ? h.monthlyFrom * (1 + h.pct / 100) * 12
        : null;

  const paths = proj?.paths || null;
  const cur = typeof paths?.currentAnnual === "number" ? paths.currentAnnual : null;
  const sq = paths?.statusQuo || null;
  const wl = paths?.withLevers || null;
  const cap = paths?.capped || null;

  // Fathom's modeled figure: the engine's independent view of the SAME, UNADJUSTED
  // plan (statusQuo first, deliberately). Reconciling the carrier's ask against the
  // pre-lever projection keeps the audit honest: staging a plan-design Adjustment
  // mid-meeting must never flip a FAIR renewal into an accusatory gap (the levers
  // get their own line in the outlook instead).
  const supported: number | null =
    typeof sq?.annual === "number" ? sq.annual : typeof wl?.annual === "number" ? wl.annual : null;
  const supportedPct: number | null =
    typeof sq?.annual === "number" && typeof sq?.changePct === "number"
      ? sq.changePct
      : typeof wl?.changePct === "number"
        ? wl.changePct
        : null;

  const gap: number | null = askAnnual != null && supported != null ? askAnnual - supported : null;
  const gapPctOfAsk: number | null =
    gap != null && askAnnual != null && askAnnual !== 0 ? (gap / askAnnual) * 100 : null;
  // FAIR verdict: the ask is within 2% of what the claims support, or the
  // carrier is asking less than the experience would justify.
  const fair =
    gap != null && askAnnual != null && (gap <= 0 || Math.abs(gap) <= 0.02 * Math.abs(askAnnual));
  const gapColor = fair
    ? "var(--good)"
    : gapPctOfAsk != null && Math.abs(gapPctOfAsk) <= 10
      ? "var(--warn)"
      : "var(--hot)";

  // ---- THE READING inputs (percent units; render only, never derive) ------
  const lr = proj?.lossRatio && typeof proj.lossRatio === "object" ? proj.lossRatio : null;
  const lrCurrent = typeof lr?.current === "number" ? lr.current : null;
  const lrTarget = typeof lr?.target === "number" ? lr.target : null;
  const lrWith = typeof lr?.withLevers === "number" ? lr.withLevers : null;
  const lossRatios: any[] = Array.isArray(review?.lossRatios) ? review.lossRatios : [];
  // Fallback framing when the engine has not sent the trio: the first benefit
  // line's stated figures, straight from review.lossRatios.
  const fallbackLR = lrCurrent == null && lossRatios.length > 0 ? lossRatios[0] : null;

  const readCurrent =
    lrCurrent ?? (typeof fallbackLR?.lossRatio === "number" ? fallbackLR.lossRatio : null);
  const readTarget =
    lrCurrent != null
      ? lrTarget
      : typeof fallbackLR?.target === "number"
        ? fallbackLR.target
        : null;
  const readWith = lrCurrent != null ? lrWith : null;

  const readDomain =
    readCurrent != null ? Math.max(readCurrent, readWith ?? 0, readTarget ?? 0, 100) * 1.12 : null;
  const readPos = (v: number) =>
    readDomain && readDomain > 0 ? Math.min(98, Math.max(2, (v / readDomain) * 100)) : 50;
  const readColor =
    readCurrent == null
      ? "var(--ink)"
      : readTarget != null
        ? readCurrent <= readTarget
          ? "var(--good)"
          : readCurrent <= readTarget * 1.25
            ? "var(--warn)"
            : "var(--hot)"
        : readCurrent <= 85
          ? "var(--good)"
          : readCurrent <= 100
            ? "var(--warn)"
            : "var(--hot)";

  // ---- Remaining payload ---------------------------------------------------
  const perLever: any[] = Array.isArray(proj?.perLever) ? proj.perLever : [];
  const removedTotal = typeof wl?.totalClaimsSaved === "number" ? wl.totalClaimsSaved : null;
  const drivers: any[] = Array.isArray(review?.drivers) ? review.drivers : [];
  const roadmapItems: any[] = Array.isArray(review?.roadmap?.items) ? review.roadmap.items : [];
  const diagnosis: any[] = Array.isArray(review?.diagnosis) ? review.diagnosis : [];
  const disclaimers: string[] = Array.isArray(review?.disclaimers) ? review.disclaimers : [];
  const recoText =
    diagnosis
      .map((d: any) => (typeof d === "string" ? d : d?.plain))
      .filter(Boolean)
      .slice(0, 2)
      .join(" ") ||
    (Array.isArray(review?.scenarios) && review.scenarios[0]?.body) ||
    "";
  const diagnosisDeployables = diagnosis.filter(
    (d: any) => d && typeof d === "object" && (d.detail || figuresOf(d).length),
  );

  // Count-tweened headline figures (top level, fixed hook order).
  const askShown = useCountTween(askAnnual);
  const supportedShown = useCountTween(supported);
  const gapShown = useCountTween(gap);
  const readShown = useCountTween(readCurrent);

  if (!review && !proj) return null;

  const headMeta = [
    carrier ? `${carrier}${h?.policy ? ` policy ${h.policy}` : ""}` : null,
    h?.effective ? `Renewal effective ${h.effective}` : null,
    typeof h?.lives === "number" ? `${h.lives} lives` : null,
    h?.experienceWindow ? `Experience ${h.experienceWindow}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const outlookMax = Math.max(cur ?? 0, sq?.annual ?? 0, cap?.annual ?? 0, wl?.annual ?? 0, 1);

  return (
    <div className="fdoc">
      <style>{CSS}</style>
      <main className="page">
        {/* HEADER ----------------------------------------------------------- */}
        <header>
          <div className="eceb-mark" role="img" aria-label="East Coast Employee Benefits" />
          <h1>The Renewal Review</h1>
          <div className="subline">
            {client}
            {headMeta ? `  ·  ${headMeta}` : ""}
          </div>
          <div className="anchor-rule" aria-hidden="true">
            <span style={{ color: "var(--ink-faint)", display: "flex" } as CSSProperties}>
              <Anchor />
            </span>
          </div>
        </header>

        {/* THE RECONCILIATION ------------------------------------------------ */}
        {(askAnnual != null || supported != null) && (
          <section>
            <SectionKick>The reconciliation</SectionKick>
            <div className={`recon${supported == null || askAnnual == null ? " two" : ""}`}>
              {askAnnual != null && (
                <div className="col">
                  <div className="clabel">The carrier&rsquo;s ask</div>
                  <div className="cfig ask num">{money0(askShown)}</div>
                  <div className="csub">
                    From your renewal letter
                    {typeof h?.pct === "number" ? ` · ${pctTxt(h.pct)}` : ""}
                    {typeof h?.monthlyTo === "number" ? ` · ${money0(h.monthlyTo)} monthly` : ""}
                  </div>
                </div>
              )}
              {supported != null ? (
                <div className="col">
                  <div className="clabel">What your claims support</div>
                  <div className="cfig support num">{money0(supportedShown)}</div>
                  <div className="csub">
                    Fathom&rsquo;s independent analysis
                    {supportedPct != null ? ` · ${pctTxt(supportedPct)}` : ""}
                  </div>
                </div>
              ) : (
                <div className="col">
                  <div className="clabel">What your claims support</div>
                  <div className="quiet">
                    Analysis in progress. Your advisor will bring the modeled figure into the room
                    shortly.
                  </div>
                </div>
              )}
              {gap != null &&
                (fair ? (
                  <div className="col">
                    <div className="cverd" style={{ color: "var(--good)" } as CSSProperties}>
                      Supported
                    </div>
                    <div
                      className="cfig num"
                      style={{ color: "var(--good)", fontWeight: 400 } as CSSProperties}
                    >
                      {money0(gapShown == null ? null : Math.abs(gapShown))}
                    </div>
                    <div className="csub">
                      This increase is consistent with your plan&rsquo;s experience. Our
                      recommendation: accept the rate and focus on plan design.
                    </div>
                  </div>
                ) : (
                  <div className="col">
                    <div className="clabel">The gap</div>
                    <div
                      className="cfig num"
                      style={{ color: gapColor, fontWeight: 400 } as CSSProperties}
                    >
                      {money0(gapShown)}
                    </div>
                    <div className="csub">
                      To examine together
                      {gapPctOfAsk != null
                        ? ` · ${plainPct(Math.abs(gapPctOfAsk), 1)} of the ask`
                        : ""}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* THE READING -------------------------------------------------------- */}
        {readCurrent != null && (
          <section className="reading">
            <SectionKick>The reading</SectionKick>
            <div className="rfig">
              <span className="rbig num" style={{ color: readColor } as CSSProperties}>
                {plainPct(readShown, 0)}
              </span>
              <span className="runit">
                {lrCurrent != null
                  ? "of every premium dollar went to claims"
                  : `${fallbackLR?.benefit || "lead benefit"} line, claims against premium`}
              </span>
            </div>
            {readDomain != null && (
              <div className="rtrack" aria-hidden="true">
                <div
                  className="rneedle"
                  style={
                    { left: `${readPos(readCurrent)}%`, background: readColor } as CSSProperties
                  }
                />
                {readTarget != null && (
                  <div
                    className="rtick"
                    style={{ left: `${readPos(readTarget)}%` } as CSSProperties}
                  />
                )}
                {readWith != null && readWith !== readCurrent && (
                  <div
                    className="rneedle second"
                    style={
                      { left: `${readPos(readWith)}%`, background: "var(--ink)" } as CSSProperties
                    }
                  />
                )}
              </div>
            )}
            <div className="rlegend">
              <span>
                <span className="sw" style={{ background: readColor } as CSSProperties} />
                Today {plainPct(readCurrent, 0)}
              </span>
              {readTarget != null && (
                <span>
                  {/* Flat gold: the satin gradient on the tick is this surface's ONE
                      gold accent; the legend swatch stays flat so gold reads once. */}
                  <span className="sw" style={{ background: "#C6A15B" } as CSSProperties} />A
                  well-priced plan {plainPct(readTarget, 0)}
                </span>
              )}
              {readWith != null && readWith !== readCurrent && (
                <span>
                  <span
                    className="sw"
                    style={{ background: "var(--ink)", opacity: 0.55 } as CSSProperties}
                  />
                  With the adjustments {plainPct(readWith, 0)}
                </span>
              )}
            </div>
            {lossRatios.length > 0 && (
              <Deployable
                summary="The line-by-line reading"
                figures={lossRatios.map((r: any) => ({
                  label: String(r?.benefit ?? ""),
                  value: `${plainPct(r?.lossRatio)}  ·  rate ${pctTxt(r?.rateChangePct)}`,
                }))}
                src="Source: your carrier's claims experience, as filed."
              />
            )}
          </section>
        )}

        {/* WHAT IS DRIVING IT -------------------------------------------------- */}
        {drivers.length > 0 && (
          <section>
            <SectionKick>What is driving it</SectionKick>
            {drivers.map((d: any, i: number) => (
              <div className="driver" key={i}>
                <p>
                  <strong>{d?.title}</strong>
                  {d?.body ? ` ${d.body}` : ""}
                </p>
                <Deployable
                  summary="Where this comes from"
                  detail={d?.detail}
                  figures={figuresOf(d)}
                  src="Source: your plan's claims experience."
                />
              </div>
            ))}
          </section>
        )}

        {/* ADJUSTMENTS APPLIED + OUTLOOK --------------------------------------- */}
        {(perLever.length > 0 || (paths && cur != null && sq)) && (
          <section>
            <SectionKick>Adjustments applied</SectionKick>
            {perLever.length > 0 ? (
              <>
                <p style={{ fontSize: 13.5 } as CSSProperties}>
                  Each line shows both sides: what it takes out of the rated claims, and what it
                  asks of your people. Nothing here changes anyone&rsquo;s care.
                </p>
                <div>
                  {perLever.map((l: any, i: number) => (
                    <div className="ledgerrow" key={i}>
                      <span className="lname">
                        {l?.name}
                        {l?.memberImpact ? (
                          <span className="limpact">
                            Member side: {String(l.memberImpact)} impact
                          </span>
                        ) : null}
                      </span>
                      <span className="lval">
                        {typeof l?.claimsSaved === "number" ? (
                          <TweenMoney value={l.claimsSaved} />
                        ) : (
                          "—"
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13.5 } as CSSProperties}>
                No adjustments are applied. The figures below show the year as it stands.
              </p>
            )}
            {/* The claims-removed total stands on its own: it must render even when the
                engine sends totalClaimsSaved without a per-lever breakdown. */}
            {removedTotal != null && (
              <div
                className="ledgerrow"
                style={{ borderTop: "1px solid var(--hair)" } as CSSProperties}
              >
                <span className="lname" style={{ fontWeight: 600 } as CSSProperties}>
                  Claims taken out of the rated year
                </span>
                <span className="lval">
                  <TweenMoney value={removedTotal} />
                </span>
              </div>
            )}

            {paths && cur != null && sq && (
              <div style={{ marginTop: 26 } as CSSProperties}>
                {/* Deliberately un-colored: the semantic ramp belongs ONLY to the
                    Reading and the reconciliation gap. The labels differentiate. */}
                <OutlookBar
                  label="Current premium"
                  annual={cur}
                  pct={null}
                  color="var(--ink-mute)"
                  max={outlookMax}
                />
                {typeof sq.annual === "number" && (
                  <OutlookBar
                    label="If nothing changes"
                    sub="full experience, no adjustments"
                    annual={sq.annual}
                    pct={typeof sq.changePct === "number" ? sq.changePct : null}
                    color="var(--ink)"
                    max={outlookMax}
                  />
                )}
                {cap && typeof cap.annual === "number" && (
                  <OutlookBar
                    label="First-renewal cap"
                    sub={cap.capped ? "the cap holds the increase" : "cap not reached"}
                    annual={cap.annual}
                    pct={typeof cap.changePct === "number" ? cap.changePct : null}
                    color="var(--ink)"
                    max={outlookMax}
                  />
                )}
                {wl && typeof wl.annual === "number" && (
                  <OutlookBar
                    label="With the adjustments applied"
                    annual={wl.annual}
                    pct={typeof wl.changePct === "number" ? wl.changePct : null}
                    color="var(--ink)"
                    max={outlookMax}
                  />
                )}
                <p
                  style={
                    { fontSize: 11.5, color: "var(--ink-mute)", marginTop: 14 } as CSSProperties
                  }
                >
                  Modeled from your plan&rsquo;s experience with stated assumptions. An estimate to
                  steer by, not a quote; your carrier confirms final rates.
                </p>
              </div>
            )}
          </section>
        )}

        {/* THE STEPS FROM HERE --------------------------------------------------- */}
        {roadmapItems.length > 0 && (
          <section>
            <SectionKick>The steps from here</SectionKick>
            <div className="steps">
              {roadmapItems.map((it: any, i: number) => (
                <div className="step" key={i}>
                  <div className="swhen">{it?.due || it?.badge || `Step ${i + 1}`}</div>
                  <div className="stitle">{it?.title}</div>
                  {it?.body ? <div className="sbody">{it.body}</div> : null}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* RECOMMENDATION --------------------------------------------------------- */}
        {recoText && (
          <section>
            <SectionKick>Recommendation</SectionKick>
            <p className="reco">{recoText}</p>
            {diagnosisDeployables.map((d: any, i: number) => (
              <Deployable
                key={i}
                summary={d?.plain ? String(d.plain).slice(0, 96) : "The figures behind this"}
                detail={d?.detail}
                figures={figuresOf(d)}
                src="Source: your plan's claims experience."
              />
            ))}
          </section>
        )}

        {/* FOOTER --------------------------------------------------------------- */}
        <footer>
          <hr className="rule" />
          <p className="fine">
            {disclaimers.length > 0
              ? disclaimers.join(" ")
              : "Drawn from your plan's claims experience. Savings are estimates against your most recent claims and are confirmed at amendment by your carrier; the renewal depends on the insurer. Your coverage is unchanged except where a cost-share shift is paired with an offsetting top-up as noted."}
          </p>
          <p className="sig">Prepared by East Coast Employee Benefits &middot; Fathom analysis</p>
          <hr className="rule soft" />
          <div className="eceb-mark-sm" role="img" aria-label="East Coast Employee Benefits" />
          <div className="anchor" aria-hidden="true">
            <Anchor />
          </div>
        </footer>
      </main>
    </div>
  );
}
