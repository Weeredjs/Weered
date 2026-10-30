"use client";

// Admin → What's inside: the create-lobby composer's step 4, with the same
// switches doing the same things (James 2026-10-30: "make sure these actually
// remove and add the widgets").
//   - Voice, video, screen share, YouTube and Twitch are Lobby.enabledModules:
//     the tools every room in the lobby offers (components/room/RoomCanvas).
//   - Events, the request board and the Home canvas live in the lobby's
//     layout. Switching one off hides its tab and takes its blocks off Home;
//     switching it on shows the tab and puts a block back on Home.
import React, { useMemo, useState } from "react";
import { LobbyData, S, apiFetch } from "./shared";
import { AcServersEditor } from "./AcServersEditor";
import { StartggEditor } from "./StartggEditor";
import { FeatureToggles } from "../../../../components/composer/InsidePicker";
import { ComposerStyles } from "../../../../components/composer/ui";
import { MODULE_FEATURES, type FeatureId } from "../../../../components/composer/catalog";
import { lobbyHasModules } from "../../../../lib/lobbyChrome";
import { sanitizeLayout, stockLayout } from "../../../../lib/lobbyLayout";
import { applyFeatures, featuresOf, type Features } from "../../../../lib/lobbyFeatures";

export function ModulesTab({ lobby, onRefresh }: { lobby: LobbyData; onRefresh: () => void }) {
  const saved = useMemo(
    () => featuresOf(lobby.enabledModules || [], lobby.layout),
    [lobby.enabledModules, lobby.layout],
  );
  const [feat, setFeat] = useState<Features>(saved);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  React.useEffect(() => {
    setFeat(saved);
  }, [saved]);

  const dirty = (Object.keys(feat) as FeatureId[]).some((k) => feat[k] !== saved[k]);

  async function save() {
    setSaving(true);
    setMsg("");
    // Keep whatever else the list holds (reddit and older keys); only the five
    // switched tools change.
    const mods = new Set(lobby.enabledModules || []);
    for (const f of MODULE_FEATURES) {
      if (feat[f]) mods.add(f);
      else mods.delete(f);
    }
    const layout = applyFeatures(
      sanitizeLayout(lobby.layout) || stockLayout(),
      saved,
      feat,
      lobbyHasModules(lobby.id, lobby.moduleType),
    );
    const j = await apiFetch(`/lobbies/${encodeURIComponent(lobby.id)}/admin/design`, {
      method: "PATCH",
      body: JSON.stringify({ enabledModules: [...mods], layout }),
    });
    setSaving(false);
    setMsg(j.ok ? "Saved. Rooms and Home have changed to match." : j.error || "Failed.");
    if (j.ok) onRefresh();
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <ComposerStyles />
      <div style={S.sectionTitle}>What&apos;s inside</div>
      <div style={{ fontSize: 12, opacity: 0.6, margin: "-4px 0 12px", lineHeight: 1.5 }}>
        The same switches as when the lobby was made. The first five decide the tools every room
        offers; Events, Request board and Home canvas add or remove their tab and their block on
        Home.
      </div>
      <FeatureToggles
        value={feat}
        accent={lobby.accentColor || "#7c3aed"}
        onToggle={(id) => setFeat((f) => ({ ...f, [id]: !f[id] }))}
      />
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
        <button
          style={{ ...S.btnPri, padding: "8px 20px", opacity: dirty ? 1 : 0.55 }}
          onClick={save}
          disabled={saving || !dirty}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {dirty && !saving && (
          <button style={{ ...S.btn, padding: "8px 14px" }} onClick={() => setFeat(saved)}>
            Undo changes
          </button>
        )}
        {msg && <span style={{ fontSize: 12, opacity: 0.7 }}>{msg}</span>}
      </div>

      {/* start.gg is game-agnostic: any lobby that runs brackets can follow a
          tournament, an organizer or a league, whatever its moduleType. */}
      <StartggEditor lobby={lobby} onRefresh={onRefresh} />

      {lobby.moduleType === "ASSETTOCORSA" && (
        <AcServersEditor lobby={lobby} onRefresh={onRefresh} />
      )}
    </div>
  );
}
