import { prisma } from '../db.js'

export default async function dashboardRoutes(app) {
  // Role-based dashboard data
  app.get('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { roles, companyId, employeeId } = request.user
    const { startDate, endDate } = request.query
    const cId = companyId

    const dateFilter = startDate && endDate ? {
      createdAt: { gte: new Date(startDate), lte: new Date(endDate) }
    } : {}

    const isAdmin = roles.includes('CLIENT_ADMIN')
    const isCLevel = roles.includes('CEO') || roles.includes('CXO')
    const isManager = roles.includes('MANAGER') || roles.includes('FLM')

    // Active OKR cycle
    const activeCycle = await prisma.okrCycle.findFirst({
      where: { companyId: cId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    })

    if (isAdmin || isCLevel) {
      // Company-wide dashboard
      const [empStats, objStats, blockersOpen, recentActivity] = await Promise.all([
        prisma.employee.groupBy({
          by: ['status'],
          where: { companyId: cId },
          _count: { _all: true }
        }),
        activeCycle ? prisma.objective.findMany({
          where: { cycleId: activeCycle.id, ...dateFilter },
          select: { progress: true, status: true, level: true }
        }) : [],
        activeCycle ? prisma.kraBlocker.count({
          where: { status: 'OPEN', keyResult: { objective: { cycleId: activeCycle.id } }, ...dateFilter }
        }) : 0,
        prisma.kraHistory.findMany({
          where: dateFilter,
          orderBy: { createdAt: 'desc' }, take: 10,
          select: { action: true, entityType: true, createdAt: true, newValue: true }
        })
      ])

      const totalEmp = empStats.reduce((s, x) => s + x._count._all, 0)
      const activeEmp = empStats.find(x => x.status === 'ACTIVE')?._count._all || 0

      const avgOkrProgress = objStats.length > 0
        ? objStats.reduce((s, o) => s + o.progress, 0) / objStats.length : 0

      return reply.send({
        success: true,
        data: {
          role: isAdmin ? 'admin' : 'clevel',
          activeCycle,
          hrms: { totalEmployees: totalEmp, activeEmployees: activeEmp },
          okr: {
            totalObjectives: objStats.length,
            avgProgress: Math.round(avgOkrProgress),
            openBlockers: blockersOpen,
            statusBreakdown: objStats.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc }, {})
          },
          recentActivity
        }
      })
    }

    if (isManager && employeeId) {
      // Manager dashboard - team focus
      const [teamMembers, teamObjectives, pendingBlockers] = await Promise.all([
        prisma.employee.findMany({
          where: { managerId: employeeId },
          select: { id: true, firstName: true, lastName: true, avatar: true, department: { select: { name: true } } }
        }),
        activeCycle ? prisma.objective.findMany({
          where: {
            cycleId: activeCycle.id,
            owner: { managerId: employeeId },
            ...dateFilter
          },
          select: { progress: true, status: true, ownerId: true, title: true }
        }) : [],
        activeCycle ? prisma.kraBlocker.count({
          where: { status: 'OPEN', keyResult: { objective: { cycleId: activeCycle.id, owner: { managerId: employeeId } } }, ...dateFilter }
        }) : 0
      ])

      return reply.send({
        success: true,
        data: {
          role: 'manager',
          activeCycle,
          team: {
            totalMembers: teamMembers.length,
            members: teamMembers
          },
          okr: {
            teamObjectives: teamObjectives.length,
            avgProgress: teamObjectives.length > 0
              ? Math.round(teamObjectives.reduce((s, o) => s + o.progress, 0) / teamObjectives.length) : 0,
            pendingBlockers
          }
        }
      })
    }

    // IC / Individual dashboard
    const myObjectives = activeCycle && employeeId ? await prisma.objective.findMany({
      where: { ownerId: employeeId, cycleId: activeCycle.id, ...dateFilter },
      include: {
        _count: { select: { keyResults: true } },
        keyResults: { select: { progress: true, status: true } }
      }
    }) : []

    const taskDateFilter = startDate && endDate ? {
      dueDate: { gte: new Date(startDate), lte: new Date(endDate) }
    } : {}

    const myTasks = employeeId ? await prisma.kraTask.findMany({
      where: { assigneeId: employeeId, status: { not: 'DONE' }, ...taskDateFilter },
      include: { actionPlan: { select: { title: true } } },
      orderBy: { dueDate: 'asc' }, take: 5
    }) : []

    const overallProgress = myObjectives.length > 0
      ? myObjectives.reduce((s, o) => s + o.progress, 0) / myObjectives.length : 0

    return reply.send({
      success: true,
      data: {
        role: 'ic',
        activeCycle,
        myOkr: {
          totalObjectives: myObjectives.length,
          overallProgress: Math.round(overallProgress),
          objectives: myObjectives
        },
        myTasks: { count: myTasks.length, tasks: myTasks }
      }
    })
  })
}
