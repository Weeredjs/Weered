import { prisma } from "./prisma";
import { GlobalRole, LobbyRole } from "@prisma/client";

// Role/permission helpers (staff + lobby owner/mod). Extracted from
// index.ts so the authorization logic is importable + unit-testable.

export function canAccessStaff(role: GlobalRole) {
  return (
    role === GlobalRole.SUPPORT ||
    role === GlobalRole.STAFF ||
    role === GlobalRole.ADMIN ||
    role === GlobalRole.GOD
  );
}

export async function getLobbyRole(userId: string, lobbyId: string): Promise<LobbyRole | null> {
  try {
    const m = await prisma.lobbyMember.findUnique({
      where: { lobbyId_userId: { lobbyId, userId } },
      select: { role: true },
    });
    return m?.role ?? null;
  } catch {
    return null;
  }
}

export async function canModLobby(
  userId: string,
  lobbyId: string,
  globalRole: GlobalRole,
): Promise<boolean> {
  if (canAccessStaff(globalRole)) return true;
  const lr = await getLobbyRole(userId, lobbyId);
  return lr === LobbyRole.OWNER || lr === LobbyRole.MOD;
}
