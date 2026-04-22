// Friend + request types.
import type { User, LivePresence } from "./user";

export type FriendState = "none" | "pending_sent" | "pending_received" | "friends";

export interface Friend extends User {
  online: boolean;
  isAway?: boolean;
  roomId?: string | null;
  roomName?: string | null;
  roomIsLobby?: boolean;
  livePresence?: LivePresence | null;
}

export interface FriendsResponse {
  ok?: boolean;
  friends: Friend[];
}

export interface FriendRequest {
  id: string;
  fromId: string;
  fromName: string;
  fromAvatar?: string | null;
  toId?: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
}

export interface FriendRequestsResponse {
  ok?: boolean;
  requests: FriendRequest[];
}
