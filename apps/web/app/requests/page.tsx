import type { Metadata } from "next";
import RequestBoard from "../../components/RequestBoard";

export const metadata: Metadata = {
  title: { absolute: "Request board · Weered" },
  description:
    "Ask for the game integration or feature you want on Weered, vote on everyone else's, and watch them move from planned to shipped.",
  openGraph: {
    title: "Request board · Weered",
    description: "Your game, wired in. Vote on what Weered builds next.",
    url: "https://weered.ca/requests",
  },
  twitter: {
    card: "summary_large_image",
    title: "Request board · Weered",
    description: "Your game, wired in. Vote on what Weered builds next.",
  },
  alternates: { canonical: "https://weered.ca/requests" },
};

const STEPS: { n: string; title: string; body: string }[] = [
  { n: "1", title: "Request", body: "Name the game or feature you want." },
  { n: "2", title: "Vote", body: "Everyone votes. The top of the board rises." },
  { n: "3", title: "We build", body: "We pick from the top and say so here." },
  { n: "4", title: "Shipped", body: "It lands in Weered and the request turns green." },
];

export default function RequestsPage() {
  return (
    <main
      style={{
        maxWidth: 860,
        margin: "0 auto",
        padding: "28px 16px 56px",
        boxSizing: "border-box",
        width: "100%",
        minWidth: 0,
        color: "var(--weered-text, rgba(243,244,246,.95))",
      }}
    >
      <header style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "var(--weered-muted, rgba(203,213,225,.72))",
            marginBottom: 6,
          }}
        >
          Request board
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(24px, 5vw, 34px)",
            lineHeight: 1.15,
            fontWeight: 900,
            letterSpacing: "-0.5px",
          }}
        >
          Your game, wired in. Vote on what we build next.
        </h1>
      </header>

      <ol
        aria-label="How it works"
        style={{
          listStyle: "none",
          margin: "0 0 28px",
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 8,
        }}
      >
        {STEPS.map((s) => (
          <li
            key={s.n}
            style={{
              border: "1px solid var(--weered-border, rgba(148,163,184,.18))",
              background: "var(--weered-panel2, rgba(2,6,23,.92))",
              borderRadius: 12,
              padding: "12px 14px",
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              minWidth: 0,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flexShrink: 0,
                width: 24,
                height: 24,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 900,
                border: "1px solid var(--weered-accent-1, #7c3aed)",
                background: "color-mix(in srgb, var(--weered-accent-1, #7c3aed) 20%, transparent)",
              }}
            >
              {s.n}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 800 }}>{s.title}</span>
              <span
                style={{
                  display: "block",
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: "var(--weered-muted, rgba(203,213,225,.72))",
                  marginTop: 2,
                }}
              >
                {s.body}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <RequestBoard />
    </main>
  );
}
