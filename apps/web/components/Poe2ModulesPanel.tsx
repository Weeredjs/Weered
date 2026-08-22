"use client";

import React from "react";
import PoeModulesPanel from "./PoeModulesPanel";

// PoE2 reuses the PoE panel; `game="poe2"` flips leagues, the Twitch category,
// the accent, and the economy source (poe2scout instead of GGG cxapi), and hides
// the PoE1-only Div Cards / Skill Tree tabs. Keeping one panel means both games
// stay in sync.
type PoeProps = React.ComponentProps<typeof PoeModulesPanel>;

export default function Poe2ModulesPanel(props: Omit<PoeProps, "game">) {
  return <PoeModulesPanel {...props} game="poe2" gameName={props.gameName ?? "Path of Exile 2"} />;
}
