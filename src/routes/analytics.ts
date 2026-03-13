import { prisma } from '../db.js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { v4 as uuidv4 } from 'uuid'

const execFileAsync = promisify(execFile)

async function callPython(scriptName, data) {
  const tmpFile = join(tmpdir(), `kra_${uuidv4()}.json`)
  await writeFile(tmpFile, JSON.stringify(data))
  try {
    const { stdout } = await execFileAsync(
      process.env.PYTHON_PATH || 'python',
      [join(process.cwd(), 'analytics', scriptName), tmpFile],
      { timeout: 30000 }
    )
    await unlink(tmpFile).catch(() => {})
    return JSON.parse(stdout)
  } catch (err) {
    await unlink(tmpFile).catch(() => {})
    throw new Error(`Python analytics error: ${err.message}`)
  }
}

export default async function analyticsRoutes(app) {
  // OKR Overview stats for a cycle
  app.get('/okr/overview/:cycleId', { onRequest: [app.authenticate] }, async (request, reply) => {
    const cycleId = request.params.cycleId
    const companyId = request.query.companyId || request.user.companyId

    const [objectives, keyResults, tasks, blockers] = await Promise.all([
      prisma.objective.findMany({
        where: { cycleId },
        select: { id: true, progress: true, status: true, type: true, level: true }
      }),
      prisma.keyResult.findMany({
        where: { objective: { cycleId } },
        select: { id: true, progress: true, status: true, type: true, currentValue: true, targetValue: true }
      }),
      prisma.kraTask.findMany({
        where: { actionPlan: { keyResult: { objective: { cycleId } } } },
        select: { id: true, status: true }
      }),
      prisma.kraBlocker.findMany({
        where: {
          OR: [
            { keyResult: { objective: { cycleId } } },
            { actionPlan: { keyResult: { objective: { cycleId } } } }
          ]
        },
        select: { id: true, status: true, severity: true }
      })
    ])

    const avgProgress = objectives.length > 0
      ? objectives.reduce((s, o) => s + o.progress, 0) / objectives.length : 0

    const statusBreakdown = objectives.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1; return acc
    }, {})

    const taskBreakdown = tasks.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1; return acc
    }, {})

    const openBlockers = blockers.filter(b => b.status === 'OPEN').length

    return reply.send({
      success: true,
      data: {
        summary: {
          totalObjectives: objectives.length,
          avgProgress: Math.round(avgProgress),
          totalKeyResults: keyResults.length,
          totalTasks: tasks.length,
          openBlockers,
          completedObjectives: objectives.filter(o => o.status === 'COMPLETED').length
        },
        statusBreakdown,
        taskBreakdown,
        progressDistribution: {
          notStarted: objectives.filter(o => o.progress === 0).length,
          inProgress: objectives.filter(o => o.progress > 0 && o.progress < 100).length,
          completed: objectives.filter(o => o.progress === 100).length
        },
        levelBreakdown: objectives.reduce((acc, o) => {
          if (!acc[o.level]) acc[o.level] = { count: 0, avgProgress: 0, progresses: [] }
          acc[o.level].count++
          acc[o.level].progresses.push(o.progress)
          return acc
        }, {})
      }
    })
  })

  // Department OKR performance
  app.get('/okr/departments/:cycleId', { onRequest: [app.authenticate] }, async (request, reply) => {
    const cycleId = request.params.cycleId
    const depts = await prisma.department.findMany({
      where: { companyId: request.user.companyId },
      include: {
        employees: {
          include: {
            objectives: {
              where: { cycleId },
              select: { progress: true, status: true }
            }
          }
        }
      }
    })

    const deptData = depts.map(d => {
      const allObjs = d.employees.flatMap(e => e.objectives)
      const avgProgress = allObjs.length > 0
        ? allObjs.reduce((s, o) => s + o.progress, 0) / allObjs.length : 0
      return {
        id: d.id, name: d.name,
        totalObjectives: allObjs.length,
        avgProgress: Math.round(avgProgress),
        employees: d.employees.length
      }
    }).filter(d => d.totalObjectives > 0)

    return reply.send({ success: true, data: deptData })
  })

  // Employee KRA scorecard
  app.get('/kra/scorecard/:employeeId/:cycleId', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { employeeId, cycleId } = request.params

    const objectives = await prisma.objective.findMany({
      where: { ownerId: employeeId, cycleId },
      include: {
        keyResults: {
          include: {
            actionPlans: { include: { tasks: { select: { status: true } } } }
          }
        }
      }
    })

    const score = objectives.length > 0
      ? objectives.reduce((s, o) => s + o.progress, 0) / objectives.length : 0

    const completedTasks = objectives.flatMap(o => o.keyResults).flatMap(kr => kr.actionPlans)
      .flatMap(ap => ap.tasks).filter(t => t.status === 'DONE').length
    const totalTasks = objectives.flatMap(o => o.keyResults).flatMap(kr => kr.actionPlans)
      .flatMap(ap => ap.tasks).length

    return reply.send({
      success: true,
      data: {
        overallScore: Math.round(score),
        totalObjectives: objectives.length,
        completedObjectives: objectives.filter(o => o.status === 'COMPLETED').length,
        completedTasks, totalTasks,
        objectives: objectives.map(o => ({
          id: o.id, title: o.title, progress: o.progress, status: o.status,
          keyResults: o.keyResults.map(kr => ({ id: kr.id, title: kr.title, progress: kr.progress, type: kr.type }))
        }))
      }
    })
  })

  // Progress trend for a key result over time
  app.get('/okr/trend/:keyResultId', { onRequest: [app.authenticate] }, async (request, reply) => {
    const checkins = await prisma.kraCheckin.findMany({
      where: { keyResultId: request.params.keyResultId },
      orderBy: { checkinDate: 'asc' },
      select: { checkinDate: true, progress: true, previousProgress: true, mood: true }
    })
    return reply.send({ success: true, data: checkins })
  })

  app.get('/hrms/overview', { onRequest: [app.authenticate] }, async (request, reply) => {
    const cId = request.query.companyId || request.user.companyId
    console.log(`[HRMS Analytics] Fetching overview for companyId: ${cId}, User: ${request.user.email}`)

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    // Use a single DB connection for all heavy analytics queries
    const [
      total, active, byDept, byPos, byGender, recentJoiners,
      divCount, deptCount, teamCount, subteamCount,
      allEmployees, ceo, hiredThisMonth, leftThisMonth, cxoCount
    ] = await prisma.$transaction([
      prisma.employee.count({ where: { companyId: cId } }),
      prisma.employee.count({ where: { companyId: cId, status: 'ACTIVE' } }),
      prisma.employee.groupBy({
        by: ['departmentId'],
        where: { companyId: cId, departmentId: { not: null } },
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ['positionId'],
        where: { companyId: cId, positionId: { not: null } },
        _count: { _all: true },
      }),
      prisma.employee.groupBy({
        by: ['gender'],
        where: { companyId: cId, gender: { not: null } },
        _count: { _all: true },
      }),
      prisma.employee.findMany({
        where: {
          companyId: cId,
          dateOfJoining: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfJoining: true,
          department: { select: { name: true } },
          avatar: true,
        },
        orderBy: { dateOfJoining: 'desc' },
        take: 10,
      }),
      prisma.department.count({ where: { companyId: cId, type: 'DIVISION' } }),
      prisma.department.count({ where: { companyId: cId, type: 'DEPARTMENT' } }),
      prisma.department.count({ where: { companyId: cId, type: 'TEAM' } }),
      prisma.department.count({ where: { companyId: cId, type: 'SUBTEAM' } }),
      prisma.employee.findMany({
        where: { companyId: cId },
        select: { dateOfJoining: true, createdAt: true },
      }),
      prisma.employee.findFirst({
        where: {
          companyId: cId,
          OR: [
            { position: { level: 'CEO' } },
            { position: { title: { contains: 'CEO' } } },
          ],
        },
        select: { id: true },
      }),
      prisma.employee.count({
        where: {
          companyId: cId,
          dateOfJoining: { gte: startOfMonth, lt: startOfNextMonth },
        },
      }),
      prisma.employee.count({
        where: {
          companyId: cId,
          dateOfLeaving: { gte: startOfMonth, lt: startOfNextMonth },
        },
      }),
      prisma.user.count({
        where: {
          companyId: cId,
          isCxo: true,
          isActive: true,
        },
      }),
    ])

    // Get names for grouping
    const [dbDepts, dbPositions] = await Promise.all([
      prisma.department.findMany({ where: { companyId: cId }, select: { id: true, name: true, type: true, parentId: true } }),
      prisma.position.findMany({ where: { companyId: cId }, select: { id: true, title: true } })
    ])

    const deptMap = Object.fromEntries(dbDepts.map(d => [d.id, d.name]))
    const deptTypeMap = Object.fromEntries(dbDepts.map(d => [d.id, d.type]))
    const posMap = Object.fromEntries(dbPositions.map(p => [p.id, p.title]))

    const deptDistribution = byDept
      .filter(d => ['DEPARTMENT', 'DIVISION', 'BUSINESS_UNIT'].includes(deptTypeMap[d.departmentId]))
      .map(d => ({ name: deptMap[d.departmentId] || 'Unknown', value: d._count._all }))

    const teamSizeAvg = byDept
      .filter(d => ['TEAM', 'SUBTEAM'].includes(deptTypeMap[d.departmentId]))
      .map(d => ({ name: deptMap[d.departmentId] || 'Unknown', value: d._count._all }))

    const positionDist = byPos.map(p => ({
      name: posMap[p.positionId] || 'Unknown',
      value: p._count._all
    }))

    // Employee Growth (last 6 months approximation)
    const monthCounts = {}
    allEmployees.forEach(e => {
        const date = e.dateOfJoining || e.createdAt
        if (date) {
            const m = date.toLocaleString('default', { month: 'short' }) + ' ' + date.getFullYear()
            monthCounts[m] = (monthCounts[m] || 0) + 1
        }
    })
    // Sort and convert
    const growthChart = Object.entries(monthCounts)
      .map(([name, added]) => ({ name, added }))
      .slice(-6)

    return reply.send({
      success: true,
      data: {
        total, active, inactive: total - active,
        totalUnits: divCount + deptCount,
        totalTeams: teamCount + subteamCount,
        totalOrgUnits: divCount + deptCount + teamCount + subteamCount,
        leadershipCount: ceo ? await prisma.employee.count({ where: { companyId: cId, managerId: ceo.id } }) : 0,
        leadershipTeamCount: ceo ? await prisma.employee.count({ where: { companyId: cId, managerId: ceo.id } }) : 0,
        cxoCount,
        movement: {
          hiredThisMonth,
          leftThisMonth
        },
        genderBreakdown: byGender,
        recentJoiners,
        charts: {
          departmentHeadcount: deptDistribution,
          teamSizes: teamSizeAvg,
          positionDistribution: positionDist,
          employeeGrowth: growthChart
        }
      }
    })
  })
}
