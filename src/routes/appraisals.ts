import { prisma } from '../db.js'

export default async function appraisalRoutes(app) {
  // === CYCLES ===
  app.get('/cycles', { onRequest: [app.authenticate] }, async (request, reply) => {
    const cId = request.query.companyId || request.user.companyId
    const cycles = await prisma.appraisalCycle.findMany({
      where: { companyId: cId },
      include: { _count: { select: { feedbacks: true } } },
      orderBy: { createdAt: 'desc' }
    })
    return reply.send({ success: true, data: cycles })
  })

  app.post('/cycles', { onRequest: [app.authenticate] }, async (request, reply) => {
    const data = { ...request.body, companyId: request.body.companyId || request.user.companyId }
    const cycle = await prisma.appraisalCycle.create({ data })
    return reply.code(201).send({ success: true, data: cycle })
  })

  app.put('/cycles/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const cycle = await prisma.appraisalCycle.update({ where: { id: request.params.id }, data: request.body })
    return reply.send({ success: true, data: cycle })
  })

  // === FEEDBACK ===
  app.get('/feedback', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { cycleId, receiverId, giverId, status } = request.query
    const feedbacks = await prisma.appraisalFeedback.findMany({
      where: {
        ...(cycleId ? { cycleId } : {}),
        ...(receiverId ? { receiverId } : {}),
        ...(giverId ? { giverId } : {}),
        ...(status ? { status } : {})
      },
      include: {
        cycle: { select: { name: true, type: true } },
        giver: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return reply.send({ success: true, data: feedbacks })
  })

  app.post('/feedback', { onRequest: [app.authenticate] }, async (request, reply) => {
    const feedback = await prisma.appraisalFeedback.create({
      data: request.body,
      include: {
        giver: { select: { firstName: true, lastName: true } },
        receiver: { select: { firstName: true, lastName: true } }
      }
    })
    return reply.code(201).send({ success: true, data: feedback })
  })

  app.put('/feedback/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { status, ...data } = request.body
    const feedback = await prisma.appraisalFeedback.update({
      where: { id: request.params.id },
      data: {
        ...data,
        ...(status === 'SUBMITTED' ? { status: 'SUBMITTED', submittedAt: new Date() } : { status })
      }
    })
    return reply.send({ success: true, data: feedback })
  })

  // Get summary for a receiver in a cycle
  app.get('/feedback/summary/:cycleId/:receiverId', { onRequest: [app.authenticate] }, async (request, reply) => {
    const feedbacks = await prisma.appraisalFeedback.findMany({
      where: { cycleId: request.params.cycleId, receiverId: request.params.receiverId, status: 'SUBMITTED' },
      include: { giver: { select: { firstName: true, lastName: true } } }
    })

    const summary = {
      totalFeedbacks: feedbacks.length,
      avgRating: feedbacks.reduce((sum, f) => sum + (f.rating || 0), 0) / Math.max(feedbacks.length, 1),
      byType: {}
    }
    feedbacks.forEach(f => {
      if (!summary.byType[f.type]) summary.byType[f.type] = { count: 0, avgRating: 0, ratings: [] }
      summary.byType[f.type].count++
      summary.byType[f.type].ratings.push(f.rating || 0)
    })
    Object.keys(summary.byType).forEach(type => {
      const ratings = summary.byType[type].ratings
      summary.byType[type].avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length
    })

    return reply.send({ success: true, data: { feedbacks, summary } })
  })
}
