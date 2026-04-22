// Activity feed types — what /activity-feed returns.
import type { NotorietyAction } from "./notoriety";

export type ActivityFeedItem =
  | {
      type: "dm";
      id: string;
      text: string;
      preview?: string;
      fromId: string;
      fromName: string;
      ts: number | string;
    }
  | {
      type: "notification";
      id: string;
      subType?: string;
      text: string;
      body?: string;
      actionUrl?: string | null;
      actorName?: string;
      read: boolean;
      ts: number | string;
    }
  | {
      type: "notoriety";
      id: string;
      text: string;
      points: number;
      action?: NotorietyAction;
      ts: number | string;
    }
  | {
      type: "friend";
      id: string;
      text: string;
      friendName?: string;
      ts: number | string;
    };

export interface ActivityFeedResponse {
  ok: boolean;
  feed: ActivityFeedItem[];
}
