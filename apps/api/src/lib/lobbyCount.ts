// How many people are in a lobby right now: everyone in any of its rooms, each
// person once. The one count every lobby listing uses (Home, Downtown, the
// public list, My lobbies). Before 2026-11-09 the listings counted only the
// lobby's front room, so a lobby whose people were all in its other rooms read
// as empty, while Home counted The Operator (the AI) and so showed "1 online"
// on every lobby (James's walkthrough: Home and Downtown never agreed).
export function lobbyOnlineCount(rooms: Map<string, any>, lobbyId: string): number {
  if (!lobbyId) return 0;
  const people = new Set<string>();
  for (const [rid, room] of rooms) {
    if (rid !== lobbyId && room?.lobbyId !== lobbyId) continue;
    const users: Map<string, any> | undefined = room?.users;
    if (!users) continue;
    for (const uid of users.keys()) if (uid !== "operator") people.add(uid);
  }
  return people.size;
}
