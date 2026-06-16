export type DmReaction = { emoji: string; count: number; users: string[] };
export type DmReplyTo = { id: string; userName: string; body: string };
export type DmMsg = {
  id: string;
  fromId: string;
  toId: string;
  body: string;
  createdAt: string;
  readAt?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  reactions?: DmReaction[];
  replyToId?: string | null;
  replyToUserId?: string | null;
  replyToUserName?: string | null;
  replyToBody?: string | null;
};
export type DmThread = {
  peerId: string;
  peerName: string;
  peerAvatar?: string | null;
  peerAvatarColor?: string | null;
  peerOnline?: boolean;
  msgs: DmMsg[];
  unread: number;
};
