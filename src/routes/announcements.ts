import { prisma } from '../db.js'

export default async function announcementsRoutes(app) {
  // Get all announcements for the user
  app.get('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { companyId } = request.user
    
    // Find employee info for the user to get department
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      include: { employee: true }
    })
    
    const employee = user?.employee
    
    // Condition: Company-wide OR targeted to employee's department
    const conditions = [{ targetAudience: 'COMPANY' }]
    if (employee && employee.departmentId) {
      conditions.push({ 
        targetAudience: { in: ['DEPARTMENT', 'TEAM'] },
        departmentId: employee.departmentId
      })
    }

    const announcements = await prisma.announcement.findMany({
      where: {
        companyId,
        isActive: true,
        OR: conditions
      },
      include: {
        author: { select: { firstName: true, lastName: true, avatar: true } },
        department: { select: { name: true } }
      },
      orderBy: { publishDate: 'desc' }
    })

    return reply.send({ success: true, data: announcements })
  })

  // Create an announcement
  app.post('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    // Should be checked for Client Admin or HR Role
    const { companyId } = request.user
    const { title, message, targetAudience, departmentId, priorityLevel, publishDate } = request.body
    
    const user = await prisma.user.findUnique({ 
      where: { id: request.user.id }, 
      include: { employee: true }
    })
    if (!user?.employee?.id) {
       return reply.code(400).send({ success: false, message: 'User is not linked to an employee profile' })
    }

    const announcement = await prisma.announcement.create({
      data: {
        companyId,
        title,
        message,
        targetAudience: targetAudience || 'COMPANY',
        departmentId: departmentId || null,
        priorityLevel: priorityLevel || 'NORMAL',
        publishDate: publishDate ? new Date(publishDate) : new Date(),
        authorId: user.employee.id
      }
    })

    return reply.code(201).send({ success: true, data: announcement, message: 'Announcement created' })
  })

  // Delete/Deactivate announcement
  app.delete('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    await prisma.announcement.update({
      where: { id: request.params.id },
      data: { isActive: false }
    })
    return reply.send({ success: true, message: 'Announcement deleted' })
  })
}
