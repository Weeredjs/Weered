// White-label 404 for any mistyped /foyer/* path (renders bare via RootFrame + foyer metadata).
export default function FoyerNotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0d1117",
        color: "#e6edf3",
        fontFamily: "system-ui,sans-serif",
        textAlign: "center",
        padding: 24,
      }}
    >
      <div>
        <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Meeting not found</h1>
        <p style={{ color: "#8b949e", margin: 0 }}>
          This meeting link isn&rsquo;t valid. Please check the link you were sent.
        </p>
      </div>
    </div>
  );
}
