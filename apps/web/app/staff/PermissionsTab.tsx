"use client";
import { PERM_SCOPES, PERM_TIERS, PermBlock } from "./shared";

export function PermissionsTab() {
  return (
    <div style={{ maxWidth: 840 }}>
      <div
        style={{ fontSize: 12, color: "rgba(148,163,184,.78)", lineHeight: 1.55, marginBottom: 16 }}
      >
        Weered uses{" "}
        <strong style={{ color: "rgba(243,244,246,.9)" }}>
          hierarchical levels across four independent scopes
        </strong>{" "}
        &mdash; each level is a strict superset of the one below it (no &agrave;-la-carte permission
        flags like Discord). One user can hold a role in each scope at once: e.g. global{" "}
        <em>Support</em> + <em>Owner</em> of their own lobby + <em>Member</em> elsewhere. The two
        tier systems are separate axes that happen to share the crime-ladder naming.
      </div>
      {PERM_SCOPES.map((s) => (
        <PermBlock key={s.title} s={s} />
      ))}
      <div style={{ height: 6 }} />
      {PERM_TIERS.map((s) => (
        <PermBlock key={s.title} s={s} />
      ))}
    </div>
  );
}
