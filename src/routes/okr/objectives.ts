import { prisma } from '../../db.js'

async function recalcObjectiveProgress(objectiveId) {
  const krs = await prisma.keyResult.findMany({ where: { objectiveId } })
  if (krs.length === 0) return
  const totalWeight = krs.reduce((sum, kr) => sum + (kr.weight || 1), 0)
  const weightedProgress = krs.reduce((sum, kr) => sum + (kr.progress * (kr.weight || 1)), 0)
  const progress = totalWeight > 0 ? weightedProgress / totalWeight : 0
  await prisma.objective.update({ where: { id: objectiveId }, data: { progress } })
}

export default async function objectiveRoutes(app) {
  // List objectives with filters
  app.get('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { cycleId, ownerId, type, level, status, departmentId, parentId, page = 1, limit = 20 } = request.query
    const skip = (Number(page) - 1) * Number(limit)

    const where = {
      ...(cycleId ? { cycleId } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(type ? { type } : {}),
      ...(level ? { level } : {}),
      ...(status ? { status } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(parentId !== undefined ? { parentId: parentId === 'null' ? null : parentId } : {})
    }

    const [total, objectives] = await Promise.all([
      prisma.objective.count({ where }),
      prisma.objective.findMany({
        where, skip, take: Number(limit),
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          parent: { select: { id: true, title: true } },
          _count: { select: { keyResults: true, children: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
    ])

    return reply.send({
      success: true, data: objectives,
      meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }
    })
  })

  // Get single objective with full details
  app.get('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const obj = await prisma.objective.findUnique({
      where: { id: request.params.id },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, avatar: true, position: { select: { title: true } } } },
        parent: { select: { id: true, title: true, progress: true } },
        children: { include: { _count: { select: { keyResults: true } } } },
        keyResults: {
          include: {
            owner: { select: { id: true, firstName: true, lastName: true, avatar: true } },
            actionPlans: { include: { _count: { select: { tasks: true } } } },
            blockers: { where: { status: 'OPEN' } },
            _count: { select: { actionPlans: true, blockers: true } }
          }
        },
        comments: {
          include: { replies: true },
          where: { parentId: null },
          orderBy: { createdAt: 'desc' }, take: 10
        },
        checkins: { orderBy: { checkinDate: 'desc' }, take: 5 },
        _count: { select: { keyResults: true, children: true, checkins: true } }
      }
    })
    if (!obj) return reply.code(404).send({ success: false, message: 'Objective not found' })
    return reply.send({ success: true, data: obj })
  })

  // Create objective
  app.post('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const objective = await prisma.objective.create({
      data: request.body,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, avatar: true } }
      }
    })
    return reply.code(201).send({ success: true, data: objective, message: 'Objective created successfully' })
  })

  // Update objective
  app.put('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const objective = await prisma.objective.update({
      where: { id: request.params.id },
      data: request.body
    })
    return reply.send({ success: true, data: objective })
  })

  // Update progress
  app.patch('/:id/progress', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { progress, status } = request.body
    const objective = await prisma.objective.update({
      where: { id: request.params.id },
      data: { progress, ...(status ? { status } : {}) }
    })
    // Add to history
    await prisma.kraHistory.create({
      data: {
        objectiveId: request.params.id,
        entityType: 'OBJECTIVE',
        entityId: request.params.id,
        action: 'PROGRESS_UPDATED',
        newValue: { progress, status },
        changedById: request.user.employeeId
      }
    })
    return reply.send({ success: true, data: objective })
  })

  // Delete objective
  app.delete('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    await prisma.objective.delete({ where: { id: request.params.id } })
    return reply.send({ success: true, message: 'Objective deleted successfully' })
  })

  // Get aligned/cascaded objectives tree for cycle
  app.get('/tree/:cycleId', { onRequest: [app.authenticate] }, async (request, reply) => {
    const allObjs = await prisma.objective.findMany({
      where: { cycleId: request.params.cycleId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { keyResults: true } }
      },
      orderBy: { createdAt: 'asc' }
    })
    const map = {}
    const roots = []
    allObjs.forEach(o => { map[o.id] = { ...o, children: [] } })
    allObjs.forEach(o => {
      if (o.parentId && map[o.parentId]) map[o.parentId].children.push(map[o.id])
      else roots.push(map[o.id])
    })
    return reply.send({ success: true, data: roots })
  })
}
