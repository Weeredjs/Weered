import Link from "next/link";

export default function MarketingHeader({
  ctaHref = "/lobby",
  ctaLabel = "Open Weered",
}: {
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(5,8,16,0.92)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "14px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <img
            src="/brand/logo/weered-logo-32.png"
            alt="Weered"
            width={28}
            height={28}
            style={{ borderRadius: 6 }}
          />
          <span
            style={{
              color: "rgba(245,245,250,0.95)",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.5px",
              fontFamily: "'Barlow Condensed', system-ui, sans-serif",
              textTransform: "uppercase",
            }}
          >
            Weered
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <Link href="/why-not-discord" style={navLinkStyle}>Why Weered</Link>
          <Link href="/lobby" style={navLinkStyle}>Lobbies</Link>
          <Link href="/premium" style={navLinkStyle}>Premium</Link>
          <Link href={ctaHref} style={ctaStyle}>{ctaLabel} →</Link>
        </nav>
      </div>
    </header>
  );
}

const navLinkStyle: React.CSSProperties = {
  fontSize: 13,
  color: "rgba(203,213,225,0.78)",
  textDecoration: "none",
  fontWeight: 500,
  letterSpacing: "0.2px",
};

const ctaStyle: React.CSSProperties = {
  fontSize: 13,
  color: "rgba(245,245,250,0.98)",
  textDecoration: "none",
  fontWeight: 700,
  background: "linear-gradient(180deg, rgba(124,58,237,0.92), rgba(91,33,182,0.92))",
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid rgba(167,139,250,0.4)",
  letterSpacing: "0.3px",
};
