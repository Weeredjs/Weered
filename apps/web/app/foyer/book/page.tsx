"use client";
// The public booking page: office.eastcoastemployeebenefits.com/book (the
// middleware sends /book here). Daily Ops 2026-11-16, for James ("Should we
// have a fucking calendar? Everyone does it?"; "What the hell. That isn't the
// calendar?"): anyone opens it, sees open times, books in one step. No knock,
// no host. Same calendar, Outlook feed and mails as the office's own booking.
import OfficeWindow from "../OfficeWindow";
import { BookFollowUp } from "../BookingPanel";

export default function BookPage() {
  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <OfficeWindow />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          boxSizing: "border-box",
          padding: "40px 16px 48px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(8,20,38,.5) 0%, rgba(6,15,29,.76) 70%, rgba(4,10,20,.86) 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/eceb-logo-white.png?v=2"
          alt="East Coast Employee Benefits"
          style={{ height: 84, width: "auto", marginBottom: 20 }}
        />
        <h1
          style={{
            fontFamily: "Georgia, 'Iowan Old Style', Cambria, serif",
            fontWeight: 400,
            fontSize: 38,
            lineHeight: 1.15,
            color: "#F3E9D2",
            margin: "0 0 10px",
            textAlign: "center",
            textShadow: "0 2px 18px rgba(0,0,0,.45)",
          }}
        >
          Book time with James Stirling
        </h1>
        <p
          style={{
            fontFamily: "'Segoe UI', Inter, system-ui, sans-serif",
            fontSize: 15.5,
            color: "rgba(214,226,240,.85)",
            margin: "0 0 26px",
            textAlign: "center",
            maxWidth: 520,
            lineHeight: 1.55,
          }}
        >
          30 minutes in James&apos;s online office. Pick a time; the link and an invite come by
          email. No app, no sign-in.
        </p>
        <BookFollowUp host={false} page getToken={() => null} onClose={() => {}} />
      </div>
    </div>
  );
}
