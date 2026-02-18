import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { RoomType, SpaceType } from "@prisma/client";
import jwt from "jsonwebtoken";

function firstEnumValue<T extends Record<string, any>>(e: T, fallback: any) {
  const v = Object.values(e)[0];
  return (v ?? fallback) as any;
}

function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const a = req.headers.authorization || "";
  if (!a.startsWith("Bearer ")) {
    reply.code(401).send({ ok: false, error: "unauthorized" });
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    reply.code(500).send({ ok: false, error: "JWT_SECRET_missing" });
    return;
  }

  try {
    const token = a.slice("Bearer ".length);
    const payload: any = jwt.verify(token, secret);

    const userId = payload?.userId ?? payload?.sub;
    if (!userId) {
      reply.code(401).send({ ok: false, error: "unauthorized" });
      return;
    }

    (req as any).auth = {
      userId: String(userId),
      displayName: payload?.displayName ? String(payload.displayName) : undefined,
    };
  } catch {
    reply.code(401).send({ ok: false, error: "unauthorized" });
  }
}

async function ensureUserHomeSpace(prisma: PrismaClient, userId: string) {
  const type = firstEnumValue(SpaceType as any, "home");
  const spaceId = `u_${userId}`; // deterministic per-user

  // Space requires owner -> connect to authed user
  await (prisma as any).space.upsert({
    where: { id: spaceId },
    update: {},
    create: {
      id: spaceId,
      name: "Home",
      type,
      owner: { connect: { id: userId } },
    },
  });

  return spaceId;
}

export function makeRoomsRoutes(prisma: PrismaClient) {
  return async function roomsRoutes(app: FastifyInstance) {
    // List rooms in the caller's Home space
    app.get(
      "/rooms",
      { preHandler: requireAuth as any },
      async (req) => {
        const userId = (req as any).auth.userId as string;
        const spaceId = `u_${userId}`;

        const rooms = await (prisma as any).room.findMany({
          where: { space: { id: spaceId } },
          select: { id: true, name: true, roomType: true },
          orderBy: { id: "desc" },
          take: 200,
        });

        return { ok: true, rooms };
      }
    );

    // Create room in the caller's Home space
    app.post(
      "/rooms",
      { preHandler: requireAuth as any },
      async (req, reply) => {
        const userId = (req as any).auth.userId as string;
        const body = (req.body || {}) as any;

        let spaceId: string;
        try {
          spaceId = await ensureUserHomeSpace(prisma, userId);
        } catch (err: any) {
          // Most likely: user record missing (dev-login didn’t create user)
          reply.code(400).send({ ok: false, error: String(err?.message ?? err) });
          return;
        }

        const roomType = body.roomType ?? firstEnumValue(RoomType as any, "office");
        const name = body.name ?? body.id ?? "New Room";

        try {
          const created = await (prisma as any).room.create({
            data: {
              ...(body.id ? { id: String(body.id) } : {}),
              name: String(name),
              roomType,
              space: { connect: { id: spaceId } },
            },
            select: { id: true, name: true, roomType: true },
          });

          return { ok: true, room: created };
        } catch (err: any) {
          reply.code(400).send({ ok: false, error: String(err?.message ?? err) });
          return;
        }
      }
    );
  };
}
