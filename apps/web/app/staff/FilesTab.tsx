"use client";
import { S } from "./shared";

export function FilesTab() {
  return (
    <div>
      <div style={{ ...S.card, textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗂️</div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>File Management</div>
        <div style={{ fontSize: 13, opacity: 0.5 }}>
          Coming soon — user avatars, uploaded media, and asset management.
        </div>
      </div>
    </div>
  );
}
