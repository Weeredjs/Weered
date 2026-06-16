import { prisma } from "./prisma";
import { GlobalRole, LobbyRole } from "@prisma/client";
import { type AuthedUser } from "./roomState";

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

// Global authz helpers (moved from index.ts).
export async function getGlobalRole(userId: string): Promise<GlobalRole> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } });
    return u?.globalRole ?? GlobalRole.USER;
  } catch {
    return GlobalRole.USER;
  }
}

export function canAssignRoles(role: GlobalRole) {
  return role === GlobalRole.STAFF || role === GlobalRole.ADMIN || role === GlobalRole.GOD;
}
export async function isGloballyBanned(userId: string): Promise<boolean> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { banned: true } });
    return u?.banned === true;
  } catch {
    return false;
  }
}

export async function isNameReserved(
  name: string,
  scope: "LOBBY" | "USERNAME" | "BOTH",
): Promise<boolean> {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) return false;
  const match = await prisma.reservedName.findFirst({
    where: {
      name: normalized,
      scope: { in: scope === "BOTH" ? ["BOTH", "LOBBY", "USERNAME"] : ["BOTH", scope] },
    },
  });
  return Boolean(match);
}

export async function hydrateGlobalRole(user: AuthedUser): Promise<AuthedUser> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        usernameKey: true,
        globalRole: true,
        tier: true,
        avatarColor: true,
        avatar: true,
        steamId: true,
        twitchLogin: true,
        xboxGamertag: true,
        livePresence: true,
        panelBgColor: true,
        panelAccentColor: true,
        pillBgColor: true,
        pillAccentColor: true,
        statusText: true,
        statusEmoji: true,
        nameEffect: true,
        avatarFrame: true,
      } as any,
    });
    return {
      ...user,
      usernameKey: (u as any)?.usernameKey ?? undefined,
      globalRole: String(u?.globalRole ?? "USER"),
      tier: String(u?.tier ?? "INNOCENT"),
      avatarColor: u?.avatarColor ?? undefined,
      avatar: u?.avatar ?? undefined,
      steamId: u?.steamId ?? undefined,
      twitchLogin: u?.twitchLogin ?? undefined,
      xboxGamertag: u?.xboxGamertag ?? undefined,
      livePresence: u?.livePresence ?? null,
      panelBgColor: (u as any)?.panelBgColor ?? undefined,
      panelAccentColor: (u as any)?.panelAccentColor ?? undefined,
      pillBgColor: (u as any)?.pillBgColor ?? undefined,
      pillAccentColor: (u as any)?.pillAccentColor ?? undefined,
      statusText: (u as any)?.statusText ?? undefined,
      statusEmoji: (u as any)?.statusEmoji ?? undefined,
      nameEffect: (u as any)?.nameEffect ?? undefined,
      avatarFrame: (u as any)?.avatarFrame ?? undefined,
    } as any;
  } catch {
    return user;
  }
}
