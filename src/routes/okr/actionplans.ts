import { prisma } from '../../db.js'

export default async function actionPlanRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { keyResultId, status, priority } = request.query
    const plans = await prisma.actionPlan.findMany({
      where: {
        ...(keyResultId ? { keyResultId } : {}),
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {})
      },
      include: {
        keyResult: { select: { id: true, title: true } },
        tasks: {
          include: { assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } } }
        },
        blockers: { where: { status: 'OPEN' } },
        _count: { select: { tasks: true, blockers: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return reply.send({ success: true, data: plans })
  })

  app.get('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const plan = await prisma.actionPlan.findUnique({
      where: { id: request.params.id },
      include: {
        keyResult: { include: { objective: true } },
        tasks: {
          include: { assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
          orderBy: { createdAt: 'asc' }
        },
        blockers: { orderBy: { createdAt: 'desc' } }
      }
    })
    if (!plan) return reply.code(404).send({ success: false, message: 'Action Plan not found' })
    return reply.send({ success: true, data: plan })
  })

  app.post('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const plan = await prisma.actionPlan.create({
      data: request.body,
      include: { keyResult: { select: { id: true, title: true } } }
    })
    return reply.code(201).send({ success: true, data: plan, message: 'Action Plan created' })
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const plan = await prisma.actionPlan.update({ where: { id: request.params.id }, data: request.body })
    return reply.send({ success: true, data: plan })
  })

  app.delete('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    await prisma.actionPlan.delete({ where: { id: request.params.id } })
    return reply.send({ success: true, message: 'Action Plan deleted' })
  })

  // Bulk create tasks for a plan
  app.post('/:id/tasks/bulk', { onRequest: [app.authenticate] }, async (request, reply) => {
    const tasks = request.body.tasks.map(t => ({ ...t, actionPlanId: request.params.id }))
    await prisma.kraTask.createMany({ data: tasks })
    return reply.send({ success: true, message: `${tasks.length} tasks created` })
  })
}
