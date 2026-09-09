"use client";
// Hell Let Loose: Vietnam — the Operations panel.
//
// Four tabs, in the order a unit reaches for them on a drill night:
//   Front Line      the linked server, live, with its rhythm
//   Roster          who is on it, by squad
//   Fire Direction  the mortar table, both ways
//   Field Manual    maps, modes, roles, vehicles
//
// The WWII panel is built on a public server list; this one is built on the
// unit's own box because Vietnam has no public list to build on. Everything
// that does not need a server works with nothing linked.
import React, { useState } from "react";
import ModuleTabBar from "../ModuleTabBar";
import FrontLines from "./FrontLines";
import RosterTab from "./Roster";
import FireDirection from "./FireDirection";
import FieldManual from "./FieldManual";
import { ACCENT, S } from "./shared";

const TABS = [
  { id: "frontline" as const, label: "Front Line" },
  { id: "roster" as const, label: "Roster" },
  { id: "fire" as const, label: "Fire Direction" },
  { id: "manual" as const, label: "Field Manual" },
];
type TabId = (typeof TABS)[number]["id"];

export default function HllvModulesPanel({
  lobbyId,
  accentColor,
  style,
}: {
  lobbyId: string;
  accentColor?: string;
  currentUserId?: string;
  style?: React.CSSProperties;
}) {
  const accent = accentColor || ACCENT;
  const [tab, setTab] = useState<TabId>("frontline");

  return (
    <div style={{ ...S.wrap, ...style }}>
      <ModuleTabBar
        tabs={TABS}
        active={tab}
        onSelect={(id) => setTab(id as TabId)}
        accent={accent}
      />
      <div style={S.body}>
        {tab === "frontline" && (
          <FrontLines
            lobbyId={lobbyId}
            game="hllv"
            accent={accent}
            onGo={(t) => setTab(t as TabId)}
          />
        )}
        {tab === "roster" && <RosterTab lobbyId={lobbyId} game="hllv" accent={accent} />}
        {tab === "fire" && <FireDirection accent={accent} />}
        {tab === "manual" && <FieldManual accent={accent} />}
      </div>
    </div>
  );
}
