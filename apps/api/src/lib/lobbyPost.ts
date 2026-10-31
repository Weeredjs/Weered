import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { broadcast, ensureRoomLoaded } from "./roomState";
import { hostAvatar } from "./hostAvatar";

// The server posting into a lobby's own chat (the room whose id is the lobby's
// id): the lobby's host (lib/lobbyHost.ts), scheduled posts and feeds
// (lib/lobbyAutomations.ts). Never as a person: as the host ("host:<lobbyId>")
// or as Weered ("weered"). roomState.ts rebuilds both shapes on reload.

export type PostAuthor = { id: string; name: string; avatar?: string; avatarColor?: string };

export const WEERED_AUTHOR: PostAuthor = {
  id: "weered",
  name: "Weered",
  avatar: "/brand/logo/weered-logo-128.png",
  avatarColor: "#7c3aed",
};

export function hostAuthor(lobbyId: string, host: { name?: string; emoji?: string }): PostAuthor {
  const name = String(host?.name || "").slice(0, 32) || "Host";
  // Its emoji is its face (lib/hostAvatar.ts); without one, chat shows its initial.
  return {
    id: `host:${lobbyId}`,
    name,
    avatar: hostAvatar(host?.emoji || ""),
    avatarColor: "#6d28d9",
  };
}

/** Is this chat author one the server speaks as (never a person)? */
export const isServerAuthor = (userId: string) => userId === "weered" || userId.startsWith("host:");

export async function postToLobbyChat(lobbyId: string, author: PostAuthor, body: string) {
  const text = String(body || "")
    .trim()
    .slice(0, 2000);
  if (!lobbyId || !text) return;
  const room = await ensureRoomLoaded(lobbyId);
  const msg = {
    id: randomUUID(),
    user: {
      id: author.id,
      name: author.name,
      role: "SYSTEM" as any,
      ...(author.avatar ? { avatar: author.avatar } : {}),
      ...(author.avatarColor ? { avatarColor: author.avatarColor } : {}),
    },
    body: text,
    ts: Date.now(),
  };
  if (Array.isArray(room.msgs)) {
    room.msgs.push(msg as any);
    if (room.msgs.length > 200) room.msgs.splice(0, room.msgs.length - 200);
  }
  await prisma.roomMessage.create({
    data: {
      id: msg.id,
      roomId: lobbyId,
      userId: author.id,
      userName: author.name,
      body: text,
      ts: new Date(msg.ts),
    },
  });
  broadcast(room, { type: "chat:new", roomId: lobbyId, msg });
}
