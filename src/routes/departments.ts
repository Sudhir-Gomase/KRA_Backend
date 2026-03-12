import { prisma } from '../db.js'

export default async function departmentRoutes(app) {
  // List departments
  app.get('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { companyId, parentId, search, page = 1, limit = 50 } = request.query
    const cId = companyId || request.user.companyId
    const skip = (Number(page) - 1) * Number(limit)

    const where = {
      companyId: cId,
      ...(parentId !== undefined ? { parentId: parentId === 'null' ? null : parentId } : {}),
      ...(search ? { name: { contains: search } } : {})
    }

    const [total, departments] = await Promise.all([
      prisma.department.count({ where }),
      prisma.department.findMany({
        where, skip, take: Number(limit),
        include: {
          parent: { select: { id: true, name: true } },
          head: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          _count: { select: { employees: true, children: true } }
        },
        orderBy: { name: 'asc' }
      })
    ])

    return reply.send({ success: true, data: departments, meta: { total, page: Number(page), limit: Number(limit) } })
  })

  // Get department tree
  app.get('/tree', { onRequest: [app.authenticate] }, async (request, reply) => {
    const cId = request.query.companyId || request.user.companyId
    const depts = await prisma.department.findMany({
      where: { companyId: cId, isActive: true },
      include: {
        head: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { employees: true } }
      },
      orderBy: { name: 'asc' }
    })

    // Build tree
    const map = {}
    const roots = []
    depts.forEach(d => { map[d.id] = { ...d, children: [] } })
    depts.forEach(d => {
      if (d.parentId && map[d.parentId]) map[d.parentId].children.push(map[d.id])
      else roots.push(map[d.id])
    })

    return reply.send({ success: true, data: roots })
  })

  // Get single department
  app.get('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const dept = await prisma.department.findUnique({
      where: { id: request.params.id },
      include: {
        parent: true,
        children: true,
        head: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        positions: true,
        _count: { select: { employees: true } }
      }
    })
    if (!dept) return reply.code(404).send({ success: false, message: 'Department not found' })
    return reply.send({ success: true, data: dept })
  })

  // Create department
  app.post('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const data = { ...request.body, companyId: request.body.companyId || request.user.companyId }
    const dept = await prisma.department.create({
      data,
      include: { parent: true, head: { select: { id: true, firstName: true, lastName: true } } }
    })
    return reply.code(201).send({ success: true, data: dept, message: 'Department created successfully' })
  })

  // Update department
  app.put('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const dept = await prisma.department.update({
      where: { id: request.params.id },
      data: request.body,
      include: { parent: true, head: { select: { id: true, firstName: true, lastName: true } } }
    })
    return reply.send({ success: true, data: dept, message: 'Department updated successfully' })
  })

  // Delete department
  app.delete('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    // Check if dept has employees
    const count = await prisma.employee.count({ where: { departmentId: request.params.id } })
    if (count > 0) {
      return reply.code(400).send({
        success: false,
        message: `Cannot delete department with ${count} active employees. Please reassign them first.`
      })
    }
    await prisma.department.update({ where: { id: request.params.id }, data: { isActive: false } })
    return reply.send({ success: true, message: 'Department deleted successfully' })
  })
}
