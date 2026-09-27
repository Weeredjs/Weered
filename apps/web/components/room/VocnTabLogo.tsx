"use client";

/**
 * The vOCN logo as the label of the room tab that opens the Crew Hub (the "va"
 * stage mode) in vOCN's rooms, in both the header's row and the one under the
 * stage. The tab's frame and hover come from the .weered-tab-vocn rules in
 * 60-lobby-themes.css, so it reads as a button to press rather than as branding.
 */
export default function VocnTabLogo() {
  return (
    <img
      src="/brand/vocn/logo-outline.png"
      alt="vOCN Crew Hub"
      width={81}
      height={18}
      // The PNG carries transparent padding (about a tenth of its height and
      // width). The margins give that back, so the tab keeps its neighbours'
      // 17px line while the lettering stays legible.
      style={{ display: "block", height: 18, width: "auto", margin: "-0.5px -6px" }}
    />
  );
}
