import { prisma } from '../../db.js'

export default async function taskRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { actionPlanId, assigneeId, status, priority, dueDate } = request.query
    const tasks = await prisma.kraTask.findMany({
      where: {
        ...(actionPlanId ? { actionPlanId } : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(dueDate ? { dueDate: { lte: new Date(dueDate) } } : {})
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        creator: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
        actionPlan: {
          select: {
            id: true, title: true,
            keyResult: { select: { id: true, title: true, objective: { select: { id: true, title: true } } } }
          }
        },
        blockers: { where: { status: 'OPEN' } },
        _count: { select: { blockers: true, comments: true } }
      },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }]
    })
    return reply.send({ success: true, data: tasks })
  })

  app.get('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const task = await prisma.kraTask.findUnique({
      where: { id: request.params.id },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        actionPlan: { include: { keyResult: { include: { objective: true } } } },
        blockers: { orderBy: { createdAt: 'desc' } },
        comments: { include: { replies: true }, where: { parentId: null }, orderBy: { createdAt: 'desc' } }
      }
    })
    if (!task) return reply.code(404).send({ success: false, message: 'Task not found' })
    return reply.send({ success: true, data: task })
  })

  app.post('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const data = request.body
    data.creatorId = request.user.employeeId
    if (data.assigneeId && data.assigneeId !== data.creatorId) {
      data.requiresApproval = true
      data.approvalStatus = 'PENDING'
    } else {
      data.requiresApproval = false
      data.approvalStatus = 'APPROVED'
    }

    const task = await prisma.kraTask.create({
      data,
      include: { assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } } }
    })
    return reply.code(201).send({ success: true, data: task, message: 'Task created' })
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const data = { ...request.body }
    if (data.status === 'DONE') data.completedAt = new Date()
    const task = await prisma.kraTask.update({ where: { id: request.params.id }, data })
    return reply.send({ success: true, data: task })
  })

  app.patch('/:id/status', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { status } = request.body
    const task = await prisma.kraTask.update({
      where: { id: request.params.id },
      data: { status, ...(status === 'DONE' ? { completedAt: new Date() } : {}) }
    })
    return reply.send({ success: true, data: task })
  })

  // Approve a task
  app.patch('/:id/approve', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { status } = request.body // APPROVED or REJECTED
    const task = await prisma.kraTask.update({
      where: { id: request.params.id },
      data: { approvalStatus: status, approvedById: request.user.employeeId }
    })
    return reply.send({ success: true, data: task })
  })

  app.delete('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    await prisma.kraTask.delete({ where: { id: request.params.id } })
    return reply.send({ success: true, message: 'Task deleted' })
  })

  // My tasks (for current user)
  app.get('/my/tasks', { onRequest: [app.authenticate] }, async (request, reply) => {
    const empId = request.user.employeeId
    if (!empId) return reply.send({ success: true, data: [] })

    const tasks = await prisma.kraTask.findMany({
      where: { assigneeId: empId },
      include: {
        actionPlan: {
          select: {
            title: true,
            keyResult: { select: { title: true, objective: { select: { title: true } } } }
          }
        },
        blockers: { where: { status: 'OPEN' } }
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }]
    })
    return reply.send({ success: true, data: tasks })
  })
}
