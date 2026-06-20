"use client";

export default function LoadingState({
  label = "Loading",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className="weered-loading"
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 8 : 12,
        padding: compact ? "18px 16px" : "36px 20px",
      }}
    >
      <span className="weered-spinner" style={compact ? { width: 18, height: 18 } : undefined} />
      <span className="weered-loading-label">{label}</span>
    </div>
  );
}
