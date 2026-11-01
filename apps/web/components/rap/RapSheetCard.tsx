"use client";

// The rap sheet itself (2026-11-01, the GTA VI launch): a booking record in
// Weered's own look. Drawn on the public page (app/rap/[name]) and live in the
// editor (app/rap) as you fill it in. Its link preview is drawn separately, in
// app/rap/[name]/opengraph-image.tsx.
import React from "react";
import { crewPath, onFileSince, STATUS, zoneLabel, type RapSheet } from "../../lib/rapSheet";
import { safeAccent, safeImage } from "../../lib/brandSafe";

const CSS = `
.rap-card { --rap-accent: #ff4d9d; position: relative; max-width: 860px; margin: 0 auto;
  border-radius: 18px; overflow: hidden; color: #ece8f3; text-align: left;
  background: radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--rap-accent) 16%, transparent) 0%, transparent 55%),
    linear-gradient(160deg, #15121c 0%, #0c0a11 100%);
  border: 1px solid rgba(255,255,255,.10); box-shadow: 0 30px 90px rgba(0,0,0,.55); }
.rap-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 12px;
  padding: 18px 26px 14px; border-bottom: 2px solid var(--rap-accent); }
.rap-title { font-size: 30px; font-weight: 900; letter-spacing: .22em; line-height: 1; white-space: nowrap; }
.rap-case { font: 700 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; opacity: .7; }
.rap-body { display: grid; grid-template-columns: 236px 1fr; gap: 26px; padding: 24px 26px 8px; }
.rap-shot { position: relative; height: 252px; border-radius: 10px; overflow: hidden;
  background: repeating-linear-gradient(to bottom, rgba(255,255,255,.07) 0 1px, transparent 1px 21px), #1b1724;
  border: 1px solid rgba(255,255,255,.08); display: flex; align-items: flex-end; justify-content: center; }
.rap-shot img, .rap-shot .rap-initial { width: 184px; height: 184px; border-radius: 12px 12px 0 0; object-fit: cover; }
.rap-initial { display: flex; align-items: center; justify-content: center; font-size: 84px; font-weight: 900; color: #fff; }
.rap-placard { margin-top: 10px; padding: 9px 12px; border-radius: 8px; background: #000; border: 1px solid rgba(255,255,255,.12);
  font: 800 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; }
.rap-placard b { display: block; font-size: 15px; letter-spacing: .04em; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rap-rows { display: grid; grid-template-columns: 128px 1fr; row-gap: 11px; column-gap: 14px; align-content: start; }
.rap-label { font-size: 11px; font-weight: 800; letter-spacing: .14em; opacity: .5; padding-top: 3px; }
.rap-value { font-size: 15px; font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
.rap-stars { color: var(--rap-accent); letter-spacing: 2px; margin-left: 8px; font-size: 15px; }
.rap-stars i { font-style: normal; opacity: .22; color: #fff; }
.rap-chip { display: inline-block; padding: 3px 9px; margin: 0 6px 6px 0; border-radius: 999px; font-size: 12.5px; font-weight: 700;
  background: color-mix(in srgb, var(--rap-accent) 14%, transparent); border: 1px solid color-mix(in srgb, var(--rap-accent) 40%, transparent); }
.rap-crew { color: inherit; text-decoration: none; border-bottom: 1px dashed color-mix(in srgb, var(--rap-accent) 60%, transparent); }
.rap-tag { font: 800 13px/1 ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--rap-accent); margin-right: 6px; }
.rap-priors { padding: 6px 26px 20px; }
.rap-stamps { display: flex; flex-wrap: wrap; gap: 10px 14px; margin-top: 8px; }
.rap-stamp { padding: 6px 12px; border: 2px solid var(--rap-accent); border-radius: 6px; color: var(--rap-accent);
  font-size: 12px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; transform: rotate(-2.5deg); }
.rap-stamp:nth-child(even) { transform: rotate(1.8deg); }
.rap-foot { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 26px 16px;
  border-top: 1px solid rgba(255,255,255,.07); font-size: 12px; opacity: .55; }
.rap-empty { padding: 4px 26px 18px; font-size: 14px; opacity: .65; }
@media (max-width: 640px) {
  .rap-body { grid-template-columns: 1fr; gap: 18px; padding: 18px 16px 6px; }
  .rap-shot { height: 220px; } .rap-shot img, .rap-shot .rap-initial { width: 160px; height: 160px; }
  .rap-head { padding: 16px 16px 12px; } .rap-title { font-size: 24px; letter-spacing: .16em; }
  .rap-rows { grid-template-columns: 104px 1fr; }
  .rap-priors, .rap-foot, .rap-empty { padding-left: 16px; padding-right: 16px; }
}
`;

function Stars({ n }: { n: number }) {
  return (
    <span className="rap-stars" aria-label={`${n} of 5 stars`}>
      {"★".repeat(n)}
      <i>{"★".repeat(5 - n)}</i>
    </span>
  );
}

export default function RapSheetCard({
  sheet: s,
  linkCrew = true,
}: {
  sheet: RapSheet;
  /** Link the crew to its page (not inside the editor's preview). */
  linkCrew?: boolean;
}) {
  const accent = safeAccent(s.crew?.accentColor, "#ff4d9d");
  const avatar = safeImage(s.avatar);
  const handles = [
    s.handles.psn ? `PSN ${s.handles.psn}` : "",
    s.handles.xbox ? `Xbox ${s.handles.xbox}` : "",
  ].filter(Boolean);
  const active = [s.hours.join(", "), s.timezone ? zoneLabel(s.timezone) : ""]
    .filter(Boolean)
    .join(" · ");
  const crew = s.crew ? (
    <>
      {s.crew.tag && <span className="rap-tag">[{s.crew.tag}]</span>}
      {s.crew.name}
      <span style={{ opacity: 0.55 }}> · {s.crew.boss ? "Boss" : "Member"}</span>
    </>
  ) : null;
  const rows: [string, React.ReactNode][] = [
    [
      "ALIAS",
      <>
        {s.name} <span style={{ opacity: 0.5 }}>@{s.username}</span>
      </>,
    ],
    [
      "STREET RANK",
      <>
        {s.rank.title}
        <Stars n={s.rank.stars} />
      </>,
    ],
    ["STATUS", STATUS[s.tier] || "Innocent"],
  ];
  if (crew)
    rows.push([
      "ASSOCIATES",
      linkCrew ? (
        <a className="rap-crew" href={crewPath(s.crew!)}>
          {crew}
        </a>
      ) : (
        crew
      ),
    ]);
  if (handles.length) rows.push(["HANDLES", handles.join(" · ")]);
  if (s.playstyles.length)
    rows.push([
      "M.O.",
      <div key="mo">
        {s.playstyles.map((p) => (
          <span key={p} className="rap-chip">
            {p}
          </span>
        ))}
      </div>,
    ]);
  if (active) rows.push(["ACTIVE", active]);
  if (s.micLabel) rows.push(["MIC", s.micLabel]);
  if (s.lookingForLabel) rows.push(["WANTS", s.lookingForLabel]);
  if (s.motto) rows.push(["LAST WORDS", <span key="m">&ldquo;{s.motto}&rdquo;</span>]);

  return (
    <article className="rap-card" style={{ ["--rap-accent" as any]: accent }}>
      <style>{CSS}</style>
      <header className="rap-head">
        <span className="rap-title">RAP SHEET</span>
        <span className="rap-case">CASE No. {s.caseNo}</span>
      </header>
      <div className="rap-body">
        <div>
          <div className="rap-shot">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- a player's own picture, any host
              <img src={avatar} alt="" />
            ) : (
              <div
                className="rap-initial"
                style={{ background: safeAccent(s.avatarColor, "#4c1d95") }}
              >
                {(s.name || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="rap-placard">
            <b>{s.name}</b>
            {s.caseNo} · on file {onFileSince(s.onFileSince)}
          </div>
        </div>
        <div className="rap-rows">
          {rows.map(([label, value]) => (
            <React.Fragment key={label}>
              <div className="rap-label">{label}</div>
              <div className="rap-value">{value}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
      {!s.filed && <div className="rap-empty">Nothing else on file yet.</div>}
      {s.priors.length > 0 && (
        <section className="rap-priors">
          <div className="rap-label">PRIORS</div>
          <div className="rap-stamps">
            {s.priors.map((p) => (
              <span key={p.id} className="rap-stamp" title={p.detail}>
                {p.label}
              </span>
            ))}
          </div>
        </section>
      )}
      <footer className="rap-foot">
        <span>weered.ca/rap/{s.username}</span>
        <span>Weered is not affiliated with any game publisher.</span>
      </footer>
    </article>
  );
}
