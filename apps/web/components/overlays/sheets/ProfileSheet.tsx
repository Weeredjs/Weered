"use client";

import React from "react";

export default function ProfileSheet({ userId }: { userId: string }) {
  return (
    <div className="p-4">
      <div className="text-lg font-semibold">Profile</div>
      <div className="text-sm opacity-70 mt-1">user: {userId}</div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold mb-1">Badges</div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-white/10 px-2 py-1">member</span>
          <span className="rounded-full border border-white/10 px-2 py-1">owner</span>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold mb-2">Actions</div>
        <div className="flex flex-col gap-2">
          <button className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-white/10" type="button">
            Message (placeholder)
          </button>
          <button className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-white/10" type="button">
            Invite to room (placeholder)
          </button>
        </div>
      </div>
    </div>
  );
}