import { prisma } from '../../db.js'

export default async function okrCycleRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const cId = request.query.companyId || request.user.companyId
    const cycles = await prisma.okrCycle.findMany({
      where: { companyId: cId },
      include: { _count: { select: { objectives: true } } },
      orderBy: [{ year: 'desc' }, { quarter: 'desc' }]
    })
    return reply.send({ success: true, data: cycles })
  })

  app.get('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const cycle = await prisma.okrCycle.findUnique({
      where: { id: request.params.id },
      include: { _count: { select: { objectives: true } } }
    })
    if (!cycle) return reply.code(404).send({ success: false, message: 'Cycle not found' })
    return reply.send({ success: true, data: cycle })
  })

  app.post('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const data = { ...request.body, companyId: request.body.companyId || request.user.companyId }
    const cycle = await prisma.okrCycle.create({ data })
    return reply.code(201).send({ success: true, data: cycle, message: 'OKR Cycle created' })
  })

  app.put('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const cycle = await prisma.okrCycle.update({ where: { id: request.params.id }, data: request.body })
    return reply.send({ success: true, data: cycle })
  })

  app.delete('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    await prisma.okrCycle.delete({ where: { id: request.params.id } })
    return reply.send({ success: true, message: 'Cycle deleted' })
  })
}
