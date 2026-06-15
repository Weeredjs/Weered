# @weered/shared

Shared TypeScript types and constants used by web, mobile, and desktop clients.

## Rule of thumb

If a type appears in **two or more clients**, it belongs here. If it's UI-only (colors, icon maps, component props), keep it in the client.

## Source of truth

The **API** (`apps/api/src/index.ts`) is the single source of truth for data shapes and business rules. This package mirrors its response types so clients don't drift when the API changes.

When you add a field to an API response, update the matching type here — then TypeScript will tell you every place in web / mobile / desktop that needs updating.

## Usage

```ts
import type { Lobby, Profile, ActivityFeedItem } from "@weered/shared";
import { NOTORIETY_ACTIONS } from "@weered/shared";
```

No build step needed — consumers import the TypeScript source directly via the workspace `@weered/shared` alias.

## What lives here

| File           | Types                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `user.ts`      | `User`, `Profile`, `GlobalRole`, `Tier`, `LivePresence`                                                                     |
| `lobby.ts`     | `Lobby`, `Room`, `ModuleType`, `JoinMode`, `LobbyDetailResponse`, `LobbiesResponse`, `RoomsResponse`, `LobbySearchResponse` |
| `friend.ts`    | `Friend`, `FriendState`, `FriendRequest`, `FriendsResponse`, `FriendRequestsResponse`                                       |
| `activity.ts`  | `ActivityFeedItem`, `ActivityFeedResponse`                                                                                  |
| `notoriety.ts` | `NOTORIETY_ACTIONS`, `NotorietyAction`, `NOTORIETY_RANKS`, `NotorietyRank`                                                  |
| `news.ts`      | `NewsArticle`, `NewsCategory`, `NewsFeedResponse`                                                                           |

## What does NOT live here

- UI-specific colors, icons, layout constants (client-specific)
- API-only logic (notoriety rules, permission checks, etc.) — those stay in `apps/api/`
- Database schema (lives in `apps/api/prisma/schema.prisma`)
- Platform-specific concerns (React Native vs React DOM differences)
