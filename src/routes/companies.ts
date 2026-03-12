import { prisma } from '../db.js'

export default async function companyRoutes(app) {
  // Get all companies (admin)
  app.get('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const companies = await prisma.company.findMany({
      include: {
        _count: { select: { employees: true, departments: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return reply.send({ success: true, data: companies })
  })

  // Get single company
  app.get('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const company = await prisma.company.findUnique({
      where: { id: request.params.id },
      include: {
        _count: { select: { employees: true, departments: true, positions: true } }
      }
    })
    if (!company) return reply.code(404).send({ success: false, message: 'Company not found' })
    return reply.send({ success: true, data: company })
  })

  // Create company
  app.post('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const data = request.body
    const company = await prisma.company.create({ data })
    return reply.code(201).send({ success: true, data: company, message: 'Company created successfully' })
  })

  // Update company
  app.put('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const company = await prisma.company.update({
      where: { id: request.params.id },
      data: request.body
    })
    return reply.send({ success: true, data: company, message: 'Company updated successfully' })
  })

  // Get company stats
  app.get('/:id/stats', { onRequest: [app.authenticate] }, async (request, reply) => {
    const [employees, departments, positions, activeEmployees] = await Promise.all([
      prisma.employee.count({ where: { companyId: request.params.id } }),
      prisma.department.count({ where: { companyId: request.params.id } }),
      prisma.position.count({ where: { companyId: request.params.id } }),
      prisma.employee.count({ where: { companyId: request.params.id, status: 'ACTIVE' } })
    ])
    return reply.send({
      success: true,
      data: { totalEmployees: employees, totalDepartments: departments, totalPositions: positions, activeEmployees }
    })
  })
}
