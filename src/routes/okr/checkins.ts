import { prisma } from '../../db.js'

export default async function checkinRoutes(app) {
  app.get('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { objectiveId, keyResultId } = request.query
    const checkins = await prisma.kraCheckin.findMany({
      where: {
        ...(objectiveId ? { objectiveId } : {}),
        ...(keyResultId ? { keyResultId } : {})
      },
      orderBy: { checkinDate: 'desc' }
    })
    return reply.send({ success: true, data: checkins })
  })

  app.post('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { keyResultId, objectiveId, progress, note, mood } = request.body

    // Get previous progress
    let previousProgress = 0
    if (keyResultId) {
      const kr = await prisma.keyResult.findUnique({ where: { id: keyResultId } })
      previousProgress = kr?.progress || 0
      await prisma.keyResult.update({
        where: { id: keyResultId },
        data: { currentValue: progress, progress }
      })
    } else if (objectiveId) {
      const obj = await prisma.objective.findUnique({ where: { id: objectiveId } })
      previousProgress = obj?.progress || 0
      await prisma.objective.update({ where: { id: objectiveId }, data: { progress } })
    }

    const checkin = await prisma.kraCheckin.create({
      data: { objectiveId, keyResultId, progress, previousProgress, note, mood }
    })
    return reply.code(201).send({ success: true, data: checkin, message: 'Check-in recorded' })
  })

  // Get progress timeline for a key result
  app.get('/timeline/:keyResultId', { onRequest: [app.authenticate] }, async (request, reply) => {
    const checkins = await prisma.kraCheckin.findMany({
      where: { keyResultId: request.params.keyResultId },
      orderBy: { checkinDate: 'asc' }
    })
    return reply.send({ success: true, data: checkins })
  })
}
