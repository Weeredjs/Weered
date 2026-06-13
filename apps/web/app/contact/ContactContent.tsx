"use client";
import React, { useEffect, useState } from "react";

export default function ContactContent() {
  const [visible,   setVisible]   = useState(false);
  const [name,      setName]      = useState("");
  const [email,     setEmail]     = useState("");
  const [msg,       setMsg]       = useState("");
  const [sending,   setSending]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [err,       setErr]       = useState("");

  useEffect(() => { setTimeout(() => setVisible(true), 100); }, []);

  async function send() {
    if (!name.trim() || !email.trim() || !msg.trim()) { setErr("All fields required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Valid email required."); return; }
    setSending(true); setErr("");
    try {
      const res = await fetch("https://formsubmit.co/ajax/james@weered.ca", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          name,
          email,
          message: msg,
          _subject: `[weered.ca] message from ${name}`,
          _captcha: "false",
        }),
      });
      const j = await res.json();
      if (j.success === "true" || j.success === true) { setSent(true); }
      else throw new Error("Delivery failed.");
    } catch (e: any) {
      setErr("Something broke. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');
        .ct-root {
          min-height: 100vh;
          background: #050810;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 24px;
          font-family: 'DM Mono', monospace;
          position: relative;
          overflow-x: hidden;
        }
        .ct-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 20%, rgba(124,58,237,0.12) 0%, transparent 55%),
            radial-gradient(ellipse 40% 35% at 80% 80%, rgba(217,70,239,0.07) 0%, transparent 55%);
          pointer-events: none;
        }
        .ct-root::after {
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
        .ct-inner {
          position: relative;
          z-index: 1;
          width: min(480px, 100%);
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.7s ease, transform 0.7s ease;
        }
        .ct-inner.visible { opacity: 1; transform: translateY(0); }
        .ct-eyebrow {
          font-size: 10px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: rgba(124,58,237,0.55);
          margin-bottom: 12px;
        }
        .ct-title {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 900;
          font-size: clamp(32px, 6vw, 52px);
          letter-spacing: -2px;
          background: linear-gradient(135deg, #fff 0%, rgba(167,139,250,0.8) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1.05;
          margin-bottom: 12px;
        }
        .ct-sub {
          font-size: 13px;
          color: rgba(255,255,255,0.3);
          line-height: 1.7;
          margin-bottom: 40px;
        }
        .ct-card {
          background: rgba(12,12,20,0.90);
          border: 1px solid rgba(124,58,237,0.2);
          border-radius: 18px;
          padding: 32px 28px;
          box-shadow: 0 0 60px rgba(124,58,237,0.08), inset 0 1px 0 rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
        }
        .ct-label {
          display: block;
          font-size: 10px;
          color: rgba(148,163,184,0.55);
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 8px;
          margin-top: 18px;
        }
        .ct-label:first-child { margin-top: 0; }
        .ct-input {
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
          resize: none;
        }
        .ct-input::placeholder { color: rgba(148,163,184,0.25); }
        .ct-input:focus {
          border-color: rgba(124,58,237,0.45);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.10);
          background: rgba(255,255,255,0.06);
        }
        .ct-err {
          margin-top: 14px;
          padding: 10px 14px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: 8px;
          color: rgba(254,202,202,0.85);
          font-size: 12px;
        }
        .ct-btn {
          width: 100%;
          margin-top: 20px;
          padding: 13px;
          background: linear-gradient(135deg, rgba(124,58,237,0.85), rgba(217,70,239,0.7));
          border: 1px solid rgba(124,58,237,0.4);
          border-radius: 10px;
          color: #fff;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s;
          box-shadow: 0 4px 20px rgba(124,58,237,0.2);
        }
        .ct-btn:hover:not(:disabled) { box-shadow: 0 4px 28px rgba(124,58,237,0.35); transform: translateY(-1px); }
        .ct-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ct-sent {
          text-align: center;
          padding: 20px 0;
        }
        .ct-sent-icon { font-size: 36px; margin-bottom: 16px; }
        .ct-sent-title {
          font-family: var(--font-barlow), 'Barlow Condensed', sans-serif;
          font-weight: 800;
          font-size: 22px;
          color: rgba(167,139,250,0.9);
          margin-bottom: 10px;
        }
        .ct-sent-sub { font-size: 12px; color: rgba(255,255,255,0.3); line-height: 1.7; }
        .ct-footer {
          margin-top: 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: rgba(255,255,255,0.12);
          border-top: 1px solid rgba(255,255,255,0.05);
          padding-top: 24px;
        }
        .ct-nav { display: flex; gap: 24px; }
        .ct-nav a { color: rgba(167,139,250,0.35); text-decoration: none; transition: color 0.2s; }
        .ct-nav a:hover { color: rgba(167,139,250,0.75); }
      `}</style>

      <div className="ct-root">
        <div className={`ct-inner${visible ? " visible" : ""}`}>

          <div style={{ marginBottom: 20 }}>
            <a href="/" aria-label="Weered home" style={{ display: "inline-block" }}>
              <img src="/brand/logo/weered-logo-512.png" alt="Weered" style={{ width: 72, height: 72, filter: "drop-shadow(0 0 20px rgba(88,0,229,0.35))" }} />
            </a>
          </div>
          <div className="ct-eyebrow">reach out</div>
          <div className="ct-title">Say something.</div>
          <div className="ct-sub">
            We don&apos;t have a support ticket system.<br />
            We don&apos;t have a chatbot.<br />
            It&apos;s just a message. Send one.
          </div>

          <div className="ct-card">
            {sent ? (
              <div className="ct-sent">
                <div className="ct-sent-icon">&#10022;</div>
                <div className="ct-sent-title">Received.</div>
                <div className="ct-sent-sub">
                  We got it.<br />
                  If it warrants a reply, you&apos;ll get one.
                </div>
              </div>
            ) : (
              <>
                <label className="ct-label">your name</label>
                <input className="ct-input" value={name} onChange={e => setName(e.target.value)}
                  placeholder="what to call you" autoComplete="name" />

                <label className="ct-label">your email</label>
                <input className="ct-input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="where to reply" autoComplete="email" />

                <label className="ct-label">message</label>
                <textarea className="ct-input" value={msg} onChange={e => setMsg(e.target.value)}
                  placeholder="say what you need to say..." rows={5} />

                {err && <div className="ct-err">{err}</div>}

                <button className="ct-btn" onClick={send} disabled={sending}>
                  {sending ? "sending..." : "send_message()"}
                </button>
              </>
            )}
          </div>

          <div className="ct-footer">
            <span>&copy; weered.ca</span>
            <nav className="ct-nav">
              <a href="/about">about</a>
              <a href="/premium">premium</a>
              <a href="/login">enter</a>
            </nav>
          </div>

        </div>
      </div>
    </>
  );
}
