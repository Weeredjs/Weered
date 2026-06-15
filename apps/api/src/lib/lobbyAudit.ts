import { prisma } from "./prisma";
import { randomUUID } from "node:crypto";

// Centralized lobby audit write. Replaces ~17 inline prisma.lobbyAudit.create
// blocks that duplicated id-generation + the field list across lobbies.ts.
export function logLobbyAudit(a: {
  lobbyId: string;
  type: string;
  actorId: string;
  actorName: string;
  note?: string;
  targetId?: string;
}): Promise<unknown> {
  return prisma.lobbyAudit.create({
    data: {
      id: randomUUID(),
      lobbyId: a.lobbyId,
      type: a.type,
      actorId: a.actorId,
      actorName: a.actorName,
      note: a.note,
      targetId: a.targetId,
    },
  });
}
