import { prisma } from '../db.js'

export default async function positionRoutes(app) {
  // List positions
  app.get('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { companyId, departmentId, level, search, page = 1, limit = 50 } = request.query
    const cId = companyId || request.user.companyId
    const skip = (Number(page) - 1) * Number(limit)

    const where = {
      companyId: cId,
      ...(departmentId ? { departmentId } : {}),
      ...(level ? { level } : {}),
      ...(search ? { title: { contains: search } } : {})
    }

    const [total, positions] = await Promise.all([
      prisma.position.count({ where }),
      prisma.position.findMany({
        where, skip, take: Number(limit),
        include: {
          department: { select: { id: true, name: true } },
          _count: { select: { employees: true } }
        },
        orderBy: { title: 'asc' }
      })
    ])

    return reply.send({ success: true, data: positions, meta: { total, page: Number(page), limit: Number(limit) } })
  })

  // Get single position
  app.get('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const position = await prisma.position.findUnique({
      where: { id: request.params.id },
      include: {
        department: true,
        employees: { select: { id: true, firstName: true, lastName: true, avatar: true, status: true } }
      }
    })
    if (!position) return reply.code(404).send({ success: false, message: 'Position not found' })
    return reply.send({ success: true, data: position })
  })

  // Create position
  app.post('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const data = { ...request.body, companyId: request.body.companyId || request.user.companyId }
    const position = await prisma.position.create({ data })
    return reply.code(201).send({ success: true, data: position, message: 'Position created successfully' })
  })

  // Update position
  app.put('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const position = await prisma.position.update({
      where: { id: request.params.id },
      data: request.body
    })
    return reply.send({ success: true, data: position, message: 'Position updated successfully' })
  })

  // Delete position
  app.delete('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const count = await prisma.employee.count({ where: { positionId: request.params.id } })
    if (count > 0) {
      return reply.code(400).send({
        success: false,
        message: `Cannot delete position with ${count} employees. Please reassign them first.`
      })
    }
    await prisma.position.update({ where: { id: request.params.id }, data: { isActive: false } })
    return reply.send({ success: true, message: 'Position deleted successfully' })
  })
}
