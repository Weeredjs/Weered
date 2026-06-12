export const metadata = {
  title: "How media works on Weered",
  description: "How image sharing, screening, reputation gating and content removal work on Weered.",
};

const S = {
  h2: { fontSize: 18, fontWeight: 800, marginTop: 28, marginBottom: 8, color: "rgba(243,244,246,.95)" } as React.CSSProperties,
  p: { fontSize: 14, lineHeight: 1.65, color: "rgba(203,213,225,.85)", margin: "8px 0" } as React.CSSProperties,
};

export default function MediaPolicyPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px 80px", fontFamily: "inherit" }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: "rgba(243,244,246,.97)", marginBottom: 4 }}>How media works on Weered</h1>
      <p style={{ ...S.p, color: "rgba(148,163,184,.7)" }}>Image sharing on Weered is built so that nobody sees content they didn&rsquo;t choose to see.</p>

      <h2 style={S.h2}>Every image is screened before it ever displays</h2>
      <p style={S.p}>Images are checked by an on-device classifier before upload, re-checked on our servers, and re-encoded — which strips all hidden metadata (including location data) from every file. Nothing reaches another user&rsquo;s screen unprocessed.</p>

      <h2 style={S.h2}>Posting images is an earned privilege</h2>
      <p style={S.p}>New accounts can&rsquo;t post media. Upload rights unlock with reputation earned through normal participation, and posting an image puts that reputation on the line: content that breaks house rules costs the uploader their standing and their media privileges. Throwaway accounts can&rsquo;t post images at all.</p>

      <h2 style={S.h2}>You choose what you see</h2>
      <p style={S.p}>Images from members who haven&rsquo;t yet established a track record display blurred until you tap to view them. Images from established members display normally. Either way, you can report any image in one tap.</p>

      <h2 style={S.h2}>Removed content stays removed</h2>
      <p style={S.p}>When staff remove an image, its digital fingerprint is permanently blocked platform-wide — re-uploading it, by anyone, fails automatically and costs the uploader their media privileges. We retain fingerprints, not the images themselves.</p>

      <h2 style={S.h2}>Reporting illegal content</h2>
      <p style={S.p}>Weered complies with Canadian law on mandatory reporting of child sexual abuse material. Reports of illegal content are escalated immediately — use the in-app report button or contact <a href="mailto:safety@weered.ca" style={{ color: "rgba(167,139,250,.9)" }}>safety@weered.ca</a>.</p>

      <h2 style={S.h2}>Storage</h2>
      <p style={S.p}>Images posted by free-tier members expire after 7 days. Members with a paid tier keep their image history permanently.</p>
    </main>
  );
}
