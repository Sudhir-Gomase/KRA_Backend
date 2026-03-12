import { prisma } from '../../db.js'

async function recalcKRProgress(keyResultId) {
  const kr = await prisma.keyResult.findUnique({ where: { id: keyResultId } })
  if (!kr) return
  let progress = 0
  if (kr.type === 'BOOLEAN') {
    progress = kr.currentValue >= 1 ? 100 : 0
  } else {
    const range = kr.targetValue - kr.startValue
    if (range !== 0) {
      progress = Math.min(100, Math.max(0, ((kr.currentValue - kr.startValue) / range) * 100))
    }
  }
  await prisma.keyResult.update({ where: { id: keyResultId }, data: { progress } })

  // Cascade up to objective
  const krs = await prisma.keyResult.findMany({ where: { objectiveId: kr.objectiveId } })
  const totalWeight = krs.reduce((sum, k) => sum + (k.weight || 1), 0)
  const objProgress = krs.reduce((sum, k) => sum + (k.progress * (k.weight || 1)), 0) / Math.max(totalWeight, 1)
  await prisma.objective.update({ where: { id: kr.objectiveId }, data: { progress: objProgress } })
}

export default async function keyResultRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { objectiveId, ownerId, status, type } = request.query
    const krs = await prisma.keyResult.findMany({
      where: {
        ...(objectiveId ? { objectiveId } : {}),
        ...(ownerId ? { ownerId } : {}),
        ...(status ? { status } : {}),
        ...(type ? { type } : {})
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        objective: { select: { id: true, title: true, cycleId: true } },
        actionPlans: { include: { _count: { select: { tasks: true } } } },
        _count: { select: { blockers: true, checkins: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return reply.send({ success: true, data: krs })
  })

  app.get('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const kr = await prisma.keyResult.findUnique({
      where: { id: request.params.id },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        objective: true,
        actionPlans: {
          include: {
            tasks: {
              include: { assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } } }
            },
            blockers: { where: { status: 'OPEN' } }
          }
        },
        blockers: { orderBy: { createdAt: 'desc' } },
        checkins: { orderBy: { checkinDate: 'desc' }, take: 10 },
        comments: { where: { parentId: null }, include: { replies: true }, orderBy: { createdAt: 'desc' } }
      }
    })
    if (!kr) return reply.code(404).send({ success: false, message: 'Key Result not found' })
    return reply.send({ success: true, data: kr })
  })

  app.post('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const kr = await prisma.keyResult.create({
      data: request.body,
      include: { owner: { select: { id: true, firstName: true, lastName: true } } }
    })
    return reply.code(201).send({ success: true, data: kr, message: 'Key Result created' })
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const kr = await prisma.keyResult.update({
      where: { id: request.params.id },
      data: request.body
    })
    await recalcKRProgress(kr.id)
    return reply.send({ success: true, data: kr })
  })

  // Update current value and auto-calculate progress
  app.patch('/:id/update-value', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { currentValue, qualitativeNote } = request.body
    const kr = await prisma.keyResult.update({
      where: { id: request.params.id },
      data: { currentValue, ...(qualitativeNote ? { qualitativeNote } : {}) }
    })
    await recalcKRProgress(kr.id)
    const updated = await prisma.keyResult.findUnique({ where: { id: kr.id } })
    return reply.send({ success: true, data: updated, message: 'Progress updated' })
  })

  app.delete('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const kr = await prisma.keyResult.findUnique({ where: { id: request.params.id } })
    await prisma.keyResult.delete({ where: { id: request.params.id } })
    // Recalc objective
    if (kr) {
      const krs = await prisma.keyResult.findMany({ where: { objectiveId: kr.objectiveId } })
      if (krs.length > 0) {
        const totalWeight = krs.reduce((sum, k) => sum + (k.weight || 1), 0)
        const objProgress = krs.reduce((sum, k) => sum + (k.progress * (k.weight || 1)), 0) / totalWeight
        await prisma.objective.update({ where: { id: kr.objectiveId }, data: { progress: objProgress } })
      }
    }
    return reply.send({ success: true, message: 'Key Result deleted' })
  })
}
