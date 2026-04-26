"use client";

import React, { useEffect, useState } from "react";

/* ── Auth helpers ──────────────────────────────────────────────────────────── */
const API = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:4000";
function getToken() {
  try { return localStorage.getItem("weered_token") || ""; } catch { return ""; }
}

/* ── Timezone + availability options ──────────────────────────────────────── */
const TIMEZONES = ["EST", "CST", "MST", "PST", "GMT", "CET", "AEST", "Other"];
const HOURS_OPTIONS = ["1-5", "5-10", "10-20", "20+"];

const REQUIREMENTS = [
  "Active on the platform (regular presence in lobbies/rooms)",
  "Fair and level-headed (no history of toxicity)",
  "Available at least a few hours per week",
  "18+ years old",
  "Comfortable enforcing community guidelines",
];

/* ── Component ────────────────────────────────────────────────────────────── */
export default function ApplyPage() {
  const [visible, setVisible] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  /* form fields */
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [timezone, setTimezone] = useState("EST");
  const [hours, setHours] = useState("1-5");
  const [activeLobbies, setActiveLobbies] = useState("");
  const [priorMod, setPriorMod] = useState("");
  const [whyMod, setWhyMod] = useState("");
  const [extra, setExtra] = useState("");

  /* submission state */
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  /* fade-in + auth check + page title */
  useEffect(() => {
    document.title = "Apply to Moderate \u2014 Weered";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Apply to become a Global Moderator on Weered. Help keep our community safe and welcoming.");
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = "Apply to become a Global Moderator on Weered. Help keep our community safe and welcoming.";
      document.head.appendChild(m);
    }
    setTimeout(() => setVisible(true), 100);
    const token = getToken();
    setAuthed(!!token);
  }, []);

  /* ── submit handler ─────────────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.trim()) { setError("Username is required."); return; }
    const ageNum = parseInt(age, 10);
    if (!age || isNaN(ageNum) || ageNum < 18) { setError("You must be at least 18 years old."); return; }
    if (!whyMod.trim()) { setError("Please tell us why you want to moderate Weered."); return; }

    const body = [
      "[MOD APPLICATION]",
      "",
      `**Username:** ${username.trim()}`,
      `**Age:** ${ageNum}`,
      `**Timezone:** ${timezone}`,
      `**Hours available per week:** ${hours}`,
      "",
      "---",
      "",
      "**Which lobbies/games are you most active in?**",
      activeLobbies.trim() || "_No answer provided._",
      "",
      "**Have you moderated before? If so, where?**",
      priorMod.trim() || "_No answer provided._",
      "",
      "**Why do you want to moderate Weered?**",
      whyMod.trim(),
      "",
      "**Anything else you want us to know?**",
      extra.trim() || "_Nothing additional._",
    ].join("\n");

    setSubmitting(true);
    try {
      const token = getToken();
      const res = await fetch(`${API}/forum/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: `Mod Application \u2014 ${username.trim()}`,
          body,
          category: "DISCUSSION",
        }),
      });
      const data = await res.json();
      if (data?.ok) {
        setSubmitted(true);
      } else {
        throw new Error(data?.error || "Submission failed.");
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');

        .mod-root {
          height: 100%;
          overflow-y: auto;
          background: #050810;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 60px 24px 80px;
          font-family: 'DM Mono', monospace;
          position: relative;
          overflow-x: hidden;
        }
        .mod-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 20%, rgba(88,0,229,0.14) 0%, transparent 55%),
            radial-gradient(ellipse 40% 35% at 80% 80%, rgba(88,0,229,0.06) 0%, transparent 55%);
          pointer-events: none;
        }
        .mod-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.016) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.016) 1px, transparent 1px);
          background-size: 52px 52px;
          pointer-events: none;
          mask-image: radial-gradient(ellipse 90% 90% at 50% 50%, black 20%, transparent 100%);
        }
        .mod-inner {
          position: relative;
          z-index: 1;
          width: min(600px, 100%);
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .mod-inner.visible { opacity: 1; transform: translateY(0); }

        .mod-eyebrow {
          font-size: 10px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: rgba(88,0,229,0.55);
          margin-bottom: 12px;
        }
        .mod-title {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 900;
          font-size: clamp(28px, 5vw, 44px);
          letter-spacing: -1.5px;
          background: linear-gradient(135deg, #fff 0%, rgba(88,0,229,0.8) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1.1;
          margin-bottom: 12px;
        }
        .mod-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.35);
          line-height: 1.7;
          margin-bottom: 36px;
        }

        /* ── cards ─────────────────────────────────── */
        .mod-card {
          background: rgba(12,12,20,0.90);
          border: 1px solid rgba(88,0,229,0.18);
          border-radius: 16px;
          padding: 28px 24px;
          box-shadow: 0 0 60px rgba(88,0,229,0.06), inset 0 1px 0 rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
          margin-bottom: 20px;
        }
        .mod-card-title {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 800;
          font-size: 16px;
          color: rgba(255,255,255,0.85);
          margin-bottom: 16px;
          letter-spacing: -0.3px;
        }

        /* ── requirements list ─────────────────────── */
        .mod-req-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .mod-req-list li {
          position: relative;
          padding: 8px 0 8px 22px;
          font-size: 12.5px;
          color: rgba(255,255,255,0.45);
          line-height: 1.6;
        }
        .mod-req-list li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 14px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(88,0,229,0.45);
          box-shadow: 0 0 8px rgba(88,0,229,0.25);
        }

        /* ── form inputs ───────────────────────────── */
        .mod-label {
          display: block;
          font-size: 10px;
          color: rgba(148,163,184,0.55);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 8px;
          margin-top: 20px;
        }
        .mod-label:first-child { margin-top: 0; }
        .mod-label .mod-req { color: rgba(88,0,229,0.6); margin-left: 4px; }
        .mod-label .mod-opt { color: rgba(148,163,184,0.3); margin-left: 4px; font-style: italic; text-transform: none; letter-spacing: 0; }

        .mod-input,
        .mod-select,
        .mod-textarea {
          width: 100%;
          padding: 12px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          color: rgba(243,244,246,0.95);
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }
        .mod-input::placeholder,
        .mod-textarea::placeholder { color: rgba(148,163,184,0.25); }
        .mod-input:focus,
        .mod-select:focus,
        .mod-textarea:focus {
          border-color: rgba(88,0,229,0.45);
          box-shadow: 0 0 0 3px rgba(88,0,229,0.10);
          background: rgba(255,255,255,0.06);
        }
        .mod-select {
          appearance: none;
          -webkit-appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' fill='none'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(148,163,184,0.4)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 36px;
          cursor: pointer;
        }
        .mod-select option {
          background: #0c0c14;
          color: #f3f4f6;
        }
        .mod-textarea {
          resize: vertical;
          min-height: 80px;
        }

        /* ── error / success ───────────────────────── */
        .mod-err {
          margin-top: 16px;
          padding: 10px 14px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 8px;
          color: rgba(254,202,202,0.85);
          font-size: 12px;
        }
        .mod-success {
          text-align: center;
          padding: 24px 0;
        }
        .mod-success-icon {
          font-size: 40px;
          margin-bottom: 16px;
          display: block;
        }
        .mod-success-title {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 800;
          font-size: 20px;
          color: rgba(88,0,229,0.9);
          margin-bottom: 10px;
        }
        .mod-success-sub {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
          line-height: 1.7;
        }

        /* ── button ────────────────────────────────── */
        .mod-btn {
          width: 100%;
          margin-top: 24px;
          padding: 14px;
          background: linear-gradient(135deg, rgba(88,0,229,0.9), rgba(130,50,255,0.75));
          border: 1px solid rgba(88,0,229,0.4);
          border-radius: 10px;
          color: #fff;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 4px 20px rgba(88,0,229,0.2);
        }
        .mod-btn:hover:not(:disabled) {
          box-shadow: 0 4px 28px rgba(88,0,229,0.4);
          transform: translateY(-1px);
        }
        .mod-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        /* ── login prompt ──────────────────────────── */
        .mod-login-card {
          text-align: center;
          padding: 40px 24px;
        }
        .mod-login-msg {
          font-size: 14px;
          color: rgba(255,255,255,0.45);
          margin-bottom: 20px;
          line-height: 1.6;
        }
        .mod-login-link {
          display: inline-block;
          padding: 12px 32px;
          background: linear-gradient(135deg, rgba(88,0,229,0.9), rgba(130,50,255,0.75));
          border: 1px solid rgba(88,0,229,0.4);
          border-radius: 10px;
          color: #fff;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          text-decoration: none;
          transition: all 0.15s;
          box-shadow: 0 4px 20px rgba(88,0,229,0.2);
        }
        .mod-login-link:hover {
          box-shadow: 0 4px 28px rgba(88,0,229,0.4);
          transform: translateY(-1px);
        }

        /* ── footer ────────────────────────────────── */
        .mod-footer {
          margin-top: 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: rgba(255,255,255,0.12);
          border-top: 1px solid rgba(255,255,255,0.05);
          padding-top: 24px;
        }
        .mod-nav { display: flex; gap: 24px; }
        .mod-nav a {
          color: rgba(88,0,229,0.4);
          text-decoration: none;
          transition: color 0.2s;
        }
        .mod-nav a:hover { color: rgba(88,0,229,0.8); }
      `}</style>

      <div className="mod-root">
        <div className={`mod-inner${visible ? " visible" : ""}`}>

          <div style={{ marginBottom: 20 }}>
            <a href="/" aria-label="Weered home" style={{ display: "inline-block" }}>
              <img src="/brand/logo/weered-logo-512.png" alt="Weered" style={{ width: 72, height: 72, filter: "drop-shadow(0 0 20px rgba(88,0,229,0.35))" }} />
            </a>
          </div>
          <div className="mod-eyebrow">// apply</div>
          <div className="mod-title">Apply to Moderate</div>
          <div className="mod-sub">
            Help us keep Weered safe and welcoming.<br />
            Global Moderators are the backbone of our community.
          </div>

          {/* ── Auth gate ──────────────────────────────────────────────── */}
          {authed === false && (
            <div className="mod-card">
              <div className="mod-login-card">
                <div className="mod-login-msg">
                  You need to be logged in to apply.
                </div>
                <a href="/login" className="mod-login-link">Log in</a>
              </div>
            </div>
          )}

          {/* ── Requirements + Form ────────────────────────────────────── */}
          {authed === true && (
            <>
              {/* Requirements */}
              <div className="mod-card">
                <div className="mod-card-title">What we expect</div>
                <ul className="mod-req-list">
                  {REQUIREMENTS.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              {/* Application form */}
              <div className="mod-card">
                {submitted ? (
                  <div className="mod-success">
                    <span className="mod-success-icon">&#10022;</span>
                    <div className="mod-success-title">Application submitted!</div>
                    <div className="mod-success-sub">
                      We&apos;ll review it and get back to you.<br />
                      Thanks for wanting to help.
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="mod-card-title">Your application</div>

                    {/* Username */}
                    <label className="mod-label">
                      Username on Weered<span className="mod-req">*</span>
                    </label>
                    <input
                      className="mod-input"
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="your weered username"
                      required
                    />

                    {/* Age */}
                    <label className="mod-label">
                      Age<span className="mod-req">*</span>
                    </label>
                    <input
                      className="mod-input"
                      type="number"
                      min={18}
                      value={age}
                      onChange={e => setAge(e.target.value)}
                      placeholder="18+"
                      required
                    />

                    {/* Timezone */}
                    <label className="mod-label">Timezone</label>
                    <select
                      className="mod-select"
                      value={timezone}
                      onChange={e => setTimezone(e.target.value)}
                    >
                      {TIMEZONES.map(tz => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>

                    {/* Hours per week */}
                    <label className="mod-label">Hours available per week</label>
                    <select
                      className="mod-select"
                      value={hours}
                      onChange={e => setHours(e.target.value)}
                    >
                      {HOURS_OPTIONS.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>

                    {/* Active lobbies */}
                    <label className="mod-label">
                      Which lobbies/games are you most active in?
                    </label>
                    <textarea
                      className="mod-textarea"
                      value={activeLobbies}
                      onChange={e => setActiveLobbies(e.target.value)}
                      placeholder="e.g. Valorant lobby, League ranked, general chat..."
                      rows={3}
                    />

                    {/* Prior moderation */}
                    <label className="mod-label">
                      Have you moderated before? If so, where?
                    </label>
                    <textarea
                      className="mod-textarea"
                      value={priorMod}
                      onChange={e => setPriorMod(e.target.value)}
                      placeholder="Discord servers, subreddits, forums..."
                      rows={3}
                    />

                    {/* Why moderate */}
                    <label className="mod-label">
                      Why do you want to moderate Weered?<span className="mod-req">*</span>
                    </label>
                    <textarea
                      className="mod-textarea"
                      value={whyMod}
                      onChange={e => setWhyMod(e.target.value)}
                      placeholder="tell us what drives you..."
                      rows={4}
                      required
                    />

                    {/* Anything else */}
                    <label className="mod-label">
                      Anything else you want us to know?<span className="mod-opt">(optional)</span>
                    </label>
                    <textarea
                      className="mod-textarea"
                      value={extra}
                      onChange={e => setExtra(e.target.value)}
                      placeholder="availability notes, relevant skills, links..."
                      rows={3}
                    />

                    {error && <div className="mod-err">{error}</div>}

                    <button className="mod-btn" type="submit" disabled={submitting}>
                      {submitting ? "submitting..." : "Submit Application"}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <div className="mod-footer">
            <span>&copy; weered.ca</span>
            <nav className="mod-nav">
              <a href="/about">about</a>
              <a href="/guidelines">guidelines</a>
              <a href="/forum">forum</a>
            </nav>
          </div>

        </div>
      </div>
    </>
  );
}
