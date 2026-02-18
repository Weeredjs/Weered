import type { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function deepMerge(base: any, patch: any): any {
  if (!isPlainObject(base)) base = {}
  if (!isPlainObject(patch)) return base
  const out: any = { ...base }
  for (const k of Object.keys(patch)) {
    const pv = (patch as any)[k]
    const bv = (base as any)[k]
    if (isPlainObject(bv) && isPlainObject(pv)) out[k] = deepMerge(bv, pv)
    else out[k] = pv
  }
  return out
}

function swallowDuplicateRoute(e: any): boolean {
  return !!e && (e.code === 'FST_ERR_DUPLICATED_ROUTE' || e.name === 'FastifyError')
}

export async function roomsStateRoutes(app: FastifyInstance) {
  // GET /rooms/:roomId/state
  try {
    app.get<{ Params: { roomId: string } }>('/rooms/:roomId/state', async (req) => {
      const roomId = req.params.roomId
      const row = await prisma.roomState.findUnique({ where: { roomId } })
      const state = row?.state ?? {}
      return { roomId, state }
    })
  } catch (e: any) {
    if (!swallowDuplicateRoute(e)) throw e
  }

  // PUT /rooms/:roomId/state  body: { patch: {...} }
  try {
    app.put<{ Params: { roomId: string }, Body: { patch: unknown } }>(
      '/rooms/:roomId/state',
      async (req, reply) => {
        const roomId = req.params.roomId
        const patch = req.body ? (req.body as any).patch : null

        if (!isPlainObject(patch)) {
          reply.code(400)
          return { ok: false, error: 'Body must be { patch: { ... } }' }
        }

        const existing = await prisma.roomState.findUnique({ where: { roomId } })
        const base = (existing?.state ?? {}) as any
        const merged = deepMerge(base, patch)

        const saved = await prisma.roomState.upsert({
          where: { roomId },
          create: { roomId, state: merged },
          update: { state: merged },
        })

        return { ok: true, roomId, state: saved.state }
      }
    )
  } catch (e: any) {
    if (!swallowDuplicateRoute(e)) throw e
  }
}

export default roomsStateRoutes