"use client";

import React from "react";
import { useWeered } from "../../WeeredProvider";

function pickFirstString(...vals: any[]) {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

export default function ProfileSheet({ userId }: { userId: string }) {
  const w = useWeered() as any;
  const me = w?.me;
  const users = Array.isArray(w?.users) ? w.users : [];

  const resolved =
    users.find((u: any) => String(u?.id || "") === String(userId)) ||
    users.find((u: any) => String(u?.name || u?.username || "") === String(userId)) ||
    (String(me?.id || "") === String(userId) ? me : null) ||
    (String(me?.name || me?.username || "") === String(userId) ? me : null) ||
    null;

  const name = pickFirstString(resolved?.name, resolved?.username, resolved?.id, userId);
  const role = String(resolved?.role || resolved?.roomRole || "").toUpperCase();

  const isMe = !!me && (String(me?.id || me?.name || me?.username) === String(resolved?.id || name));

  function openDM() {
    try {
      const peerName = name;
      const peerId = pickFirstString(resolved?.id, resolved?.userId, "");
      window.dispatchEvent(
        new CustomEvent("weered:dock:open", {
          detail: { mode: "dm", peer: { id: peerId, name: peerName } },
        })
      );
    } catch {}
  }

  return (
    <div className="p-4">
      <div className="text-lg font-semibold">Profile</div>
      <div className="text-sm opacity-70 mt-1">{isMe ? "You" : "User"}: {name}</div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{name}</div>
            <div className="text-xs opacity-70 truncate">{resolved?.id ? "id: " + String(resolved.id) : "id: (unknown)"}</div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">member</span>
            {role ? <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">{role.toLowerCase()}</span> : null}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold mb-2">Actions</div>
        <div className="flex flex-col gap-2">
          <button
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-white/10"
            type="button"
            onClick={openDM}
          >
            Message
          </button>

          <button
            className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-white/10"
            type="button"
            disabled
          >
            Invite to room (next)
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold mb-2">About</div>
        <div className="text-xs opacity-70">
          v0 profile sheet. Next: real user fields (display name, avatar), admin controls (mute/kick), notes.
        </div>
      </div>
    </div>
  );
}