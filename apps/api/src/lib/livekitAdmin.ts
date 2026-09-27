import { RoomServiceClient } from "livekit-server-sdk";
import { swallow } from "./logger";

/**
 * Server-side LiveKit control. A voice token is checked once, at connect, so
 * closing someone's Weered socket does NOT end their audio: a user kicked or
 * banned from a room, or demoted out of a gated one, stayed in the call until
 * they left on their own. This removes them from the LiveKit room too.
 *
 * Best-effort by design: a LiveKit outage must never block a moderation action,
 * so every failure is swallowed and the socket-side removal still happens.
 */

let client: RoomServiceClient | null | undefined;

function serviceClient(): RoomServiceClient | null {
  if (client !== undefined) return client;
  const url = process.env.LIVEKIT_URL || process.env.LIVEKIT_WS_URL || "";
  const key = process.env.LIVEKIT_API_KEY || "";
  const secret = process.env.LIVEKIT_API_SECRET || "";
  // The Room Service API is HTTP(S) on the same host as the signalling socket.
  const host = url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
  client = host && key && secret ? new RoomServiceClient(host, key, secret) : null;
  return client;
}

/** Remove one participant (identity = Weered user id) from one LiveKit room. */
export async function removeFromVoice(roomName: string, identity: string): Promise<void> {
  const c = serviceClient();
  if (!c || !roomName || !identity) return;
  try {
    await c.removeParticipant(roomName, identity);
  } catch (e) {
    // "participant not found" is the common case: they were never in the call.
    swallow(e);
  }
}
