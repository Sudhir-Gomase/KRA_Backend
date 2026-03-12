import { prisma } from '../../db.js'

export default async function blockerRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { keyResultId, actionPlanId, taskId, status, severity } = request.query
    const blockers = await prisma.kraBlocker.findMany({
      where: {
        ...(keyResultId ? { keyResultId } : {}),
        ...(actionPlanId ? { actionPlanId } : {}),
        ...(taskId ? { taskId } : {}),
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {})
      },
      include: {
        keyResult: { select: { id: true, title: true } },
        actionPlan: { select: { id: true, title: true } },
        task: { select: { id: true, title: true } },
        comments: { orderBy: { createdAt: 'desc' }, take: 3 }
      },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }]
    })
    return reply.send({ success: true, data: blockers })
  })

  app.get('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const blocker = await prisma.kraBlocker.findUnique({
      where: { id: request.params.id },
      include: {
        keyResult: true, actionPlan: true, task: true,
        comments: { include: { replies: true }, where: { parentId: null }, orderBy: { createdAt: 'desc' } }
      }
    })
    if (!blocker) return reply.code(404).send({ success: false, message: 'Blocker not found' })
    return reply.send({ success: true, data: blocker })
  })

  app.post('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const blocker = await prisma.kraBlocker.create({ data: { ...request.body, reportedById: request.user.employeeId } })
    return reply.code(201).send({ success: true, data: blocker, message: 'Blocker reported' })
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const blocker = await prisma.kraBlocker.update({ where: { id: request.params.id }, data: request.body })
    return reply.send({ success: true, data: blocker })
  })

  app.patch('/:id/resolve', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { resolution } = request.body
    const blocker = await prisma.kraBlocker.update({
      where: { id: request.params.id },
      data: { status: 'RESOLVED', resolution, resolvedById: request.user.employeeId, resolvedAt: new Date() }
    })
    return reply.send({ success: true, data: blocker, message: 'Blocker resolved' })
  })

  app.delete('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    await prisma.kraBlocker.delete({ where: { id: request.params.id } })
    return reply.send({ success: true, message: 'Blocker deleted' })
  })
}
