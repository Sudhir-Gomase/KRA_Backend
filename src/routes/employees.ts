import { prisma } from '../db.js'
import ExcelJS from 'exceljs'
import { createWriteStream } from 'fs'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import bcrypt from 'bcryptjs'

const EMPLOYEE_SELECT = {
  id: true, employeeCode: true, firstName: true, lastName: true,
  email: true, phone: true, gender: true, dateOfBirth: true,
  dateOfJoining: true, dateOfLeaving: true, status: true, employmentType: true,
  grade: true, band: true, location: true, avatar: true,
  department: { select: { id: true, name: true } },
  position: { select: { id: true, title: true } },
  manager: { select: { id: true, firstName: true, lastName: true, avatar: true } },
  _count: { select: { reportees: true } }
}

export default async function employeeRoutes(app) {
  // List employees with pagination, search, filter
  app.get('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const {
      companyId, departmentId, positionId, managerId, status,
      employmentType, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc'
    } = request.query

    const cId = companyId || request.user.companyId
    const skip = (Number(page) - 1) * Number(limit)

    const where = {
      companyId: cId,
      ...(departmentId ? { departmentId } : {}),
      ...(positionId ? { positionId } : {}),
      ...(managerId ? { managerId } : {}),
      ...(status ? { status } : {}),
      ...(employmentType ? { employmentType } : {}),
      ...(search ? {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { email: { contains: search } },
          { employeeCode: { contains: search } },
          { phone: { contains: search } }
        ]
      } : {})
    }

    const [total, employees] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.findMany({
        where, skip, take: Number(limit),
        select: EMPLOYEE_SELECT,
        orderBy: { [sortBy]: sortOrder }
      })
    ])

    return reply.send({
      success: true,
      data: employees,
      meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) }
    })
  })

  // Get single employee
  app.get('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const emp = await prisma.employee.findUnique({
      where: { id: request.params.id },
      include: {
        department: true, position: true,
        manager: { select: { id: true, firstName: true, lastName: true, avatar: true, position: { select: { title: true } } } },
        reportees: { select: { id: true, firstName: true, lastName: true, avatar: true, position: { select: { title: true } } } },
        user: { select: { id: true, email: true, lastLogin: true, userRoles: { include: { role: true } } } }
      }
    })
    if (!emp) return reply.code(404).send({ success: false, message: 'Employee not found' })
    return reply.send({ success: true, data: emp })
  })

  // Create employee
  app.post('/', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { createUserAccount, ...empData } = request.body
    const cId = empData.companyId || request.user.companyId

    // Auto-generate employee code if not provided
    if (!empData.employeeCode) {
      const count = await prisma.employee.count({ where: { companyId: cId } })
      empData.employeeCode = `EMP${String(count + 1).padStart(4, '0')}`
    }

    const employee = await prisma.employee.create({
      data: { ...empData, companyId: cId },
      include: { department: true, position: true }
    })

    // Auto-create user account if email provided
    if (createUserAccount && employee.email) {
      const defaultPass = await bcrypt.hash('Welcome@123', 12)
      const icRole = await prisma.role.findUnique({ where: { name: 'IC' } })
      const user = await prisma.user.create({
        data: {
          companyId: cId,
          employeeId: employee.id,
          email: employee.email,
          password: defaultPass,
          firstName: employee.firstName,
          lastName: employee.lastName
        }
      })
      if (icRole) {
        await prisma.userRole.create({ data: { userId: user.id, roleId: icRole.id } })
      }
    }

    return reply.code(201).send({ success: true, data: employee, message: 'Employee created successfully' })
  })

  // Update employee
  app.put('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const prev = await prisma.employee.findUnique({ where: { id: request.params.id } })
    const emp = await prisma.employee.update({
      where: { id: request.params.id },
      data: request.body,
      include: { department: true, position: true }
    })

    if (prev && prev.status === 'ACTIVE' && (emp.status === 'INACTIVE' || emp.status === 'TERMINATED') && emp.managerId) {
      // Transfer OKR responsibilities to manager
      await prisma.objective.updateMany({ where: { ownerId: emp.id }, data: { ownerId: emp.managerId } })
      await prisma.keyResult.updateMany({ where: { ownerId: emp.id }, data: { ownerId: emp.managerId } })
      await prisma.kraTask.updateMany({ where: { assigneeId: emp.id }, data: { assigneeId: emp.managerId } })
    }

    return reply.send({ success: true, data: emp, message: 'Employee updated successfully' })
  })

  // Delete (soft delete)
  app.delete('/:id', { onRequest: [app.authenticate] }, async (request, reply) => {
    const emp = await prisma.employee.update({
      where: { id: request.params.id },
      data: { status: 'TERMINATED', isActive: false, dateOfLeaving: new Date() }
    })
    
    if (emp.managerId) {
      await prisma.objective.updateMany({ where: { ownerId: emp.id }, data: { ownerId: emp.managerId } })
      await prisma.keyResult.updateMany({ where: { ownerId: emp.id }, data: { ownerId: emp.managerId } })
      await prisma.kraTask.updateMany({ where: { assigneeId: emp.id }, data: { assigneeId: emp.managerId } })
    }

    return reply.send({ success: true, message: 'Employee removed successfully' })
  })

  // Bulk upload via Excel
  app.post('/bulk-upload', { onRequest: [app.authenticate] }, async (request, reply) => {
    const data = await request.file()
    if (!data) return reply.code(400).send({ success: false, message: 'No file uploaded' })

    const cId = request.query.companyId || request.user.companyId
    const chunks = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]

    const headers = []
    sheet.getRow(1).eachCell(cell => headers.push(cell.value?.toString().trim()))

    const results = { success: 0, failed: 0, errors: [] }
    const rows = []

    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return
      const obj = {}
      row.eachCell((cell, colNum) => {
        obj[headers[colNum - 1]] = cell.value?.toString().trim()
      })
      if (Object.keys(obj).length > 0) rows.push({ obj, rowNum })
    })

    try {
      // 1. Extract and create Business Units, Departments, Teams
      const createdDepts = {} // name: id mapping
      
      const ensureDept = async (name, type, parentId = null) => {
        if (!name) return null
        const key = `${name.toLowerCase()}_${type}`
        if (createdDepts[key]) return createdDepts[key]
        
        let dept = await prisma.department.findFirst({
          where: { companyId: cId, name, type, parentId }
        })
        if (!dept) {
          dept = await prisma.department.create({
            data: { companyId: cId, name, type, parentId, isActive: true }
          })
        }
        createdDepts[key] = dept.id
        return dept.id
      }

      // 2. Process hierarchy and positions for each row
      const posMap = {} // title_level: id
      const codeToDbId = {} // mapping employeeCode to internal ID
      const employeeDataToSave = [] // Prepare data for insert

      for (const { obj, rowNum } of rows) {
        if (!obj['Employee_Name'] && !obj['firstName'] && !obj['employeeCode']) continue

        // Build 4-level hierarchy
        const divId = await ensureDept(obj['division'] || obj['Division'], 'DIVISION')
        const deptId = await ensureDept(obj['department'] || obj['Department'], 'DEPARTMENT', divId)
        const teamId = await ensureDept(obj['team'] || obj['Team'], 'TEAM', deptId)
        const subteamId = await ensureDept(obj['subteam'] || obj['Subteam'], 'SUBTEAM', teamId)
        
        // Target deptId for user is subteamId > teamId > deptId > divId
        const finalDeptId = subteamId || teamId || deptId || divId

        // Build position
        const posTitle = obj['Position'] || 'Employee'
        const posLevel = obj['Role_Level'] || 'Employee'
        const posKey = `${posTitle.toLowerCase()}_${posLevel.toLowerCase()}`
        
        let posId = posMap[posKey]
        if (!posId) {
          let pos = await prisma.position.findFirst({
            where: { companyId: cId, title: posTitle, level: posLevel }
          })
          if (!pos) {
            pos = await prisma.position.create({
              data: { companyId: cId, title: posTitle, level: posLevel, isActive: true }
            })
          }
          posMap[posKey] = pos.id
          posId = pos.id
        }

        const firstName = obj['firstName'] || obj['Employee_Name']?.split(' ')[0] || ''
        const lastName = obj['lastName'] || obj['Employee_Name']?.split(' ').slice(1).join(' ') || ''
        const code = obj['employeeCode'] || obj['Employee_ID'] || `EMP${Date.now()}${rowNum}`
        const reportingManagerCode = obj['reportingManager'] || obj['Reporting_Manager'] || null
        const jobRole = obj['jobRole'] || obj['Position'] || 'Employee'

        employeeDataToSave.push({
          rowNum,
          code,
          firstName,
          lastName,
          email: obj['email'] || obj['Email'] || null,
          deptId: finalDeptId,
          posTitle: jobRole,
          posLevel: obj['Role_Level'] || (jobRole === 'CEO' ? 'CEO' : jobRole === 'Business Head' ? 'CXO' : 'Employee'),
          location: obj['location'] || obj['Location'] || null,
          status: (obj['status'] || obj['Status']) === 'Inactive' ? 'INACTIVE' : 'ACTIVE',
          reportingManagerCode
        })
      }

      // 3. Ensure Positions exist
      for (const empData of employeeDataToSave) {
        const posKey = `${empData.posTitle.toLowerCase()}_${empData.posLevel.toLowerCase()}`
        if (!posMap[posKey]) {
          let pos = await prisma.position.findFirst({
            where: { companyId: cId, title: empData.posTitle, level: empData.posLevel }
          })
          if (!pos) {
            pos = await prisma.position.create({
              data: { companyId: cId, title: empData.posTitle, level: empData.posLevel, isActive: true }
            })
          }
          posMap[posKey] = pos.id
        }
        empData.posId = posMap[posKey]
      }

      // 3. First pass: Upsert employees
      for (const empData of employeeDataToSave) {
        try {
          const emp = await prisma.employee.upsert({
            where: { companyId_employeeCode: { companyId: cId, employeeCode: empData.code } },
            update: {
              firstName: empData.firstName,
              lastName: empData.lastName,
              email: empData.email,
              departmentId: empData.deptId,
              positionId: empData.posId,
              location: empData.location,
              status: empData.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE'
            },
            create: {
              companyId: cId,
              employeeCode: empData.code,
              firstName: empData.firstName,
              lastName: empData.lastName,
              email: empData.email,
              departmentId: empData.deptId,
              positionId: empData.posId,
              location: empData.location,
              status: empData.status === 'Inactive' ? 'INACTIVE' : 'ACTIVE'
            }
          })
          codeToDbId[empData.code] = emp.id
          results.success++
        } catch (err) {
          results.failed++
          results.errors.push({ row: empData.rowNum, error: err.message })
        }
      }

      // 4. Second pass: Link Reporting Managers
      for (const empData of employeeDataToSave) {
        if (empData.reportingManagerCode && codeToDbId[empData.reportingManagerCode]) {
          await prisma.employee.update({
            where: { id: codeToDbId[empData.code] },
            data: { managerId: codeToDbId[empData.reportingManagerCode] }
          })
        } else if (empData.reportingManagerCode) {
           // Maybe manager is already in DB but not in this upload
           const mgr = await prisma.employee.findFirst({
             where: { companyId: cId, employeeCode: empData.reportingManagerCode }
           })
           if (mgr) {
             await prisma.employee.update({
               where: { id: codeToDbId[empData.code] },
               data: { managerId: mgr.id }
             })
           }
        }
      }

      return reply.send({
        success: true,
        data: results,
        message: `Processed. ${results.success} succeeded, ${results.failed} failed.`
      })
    } catch (e) {
      return reply.code(500).send({ success: false, message: e.message })
    }
  })

  // Download Excel template
  app.get('/template/download', { onRequest: [app.authenticate] }, async (request, reply) => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Employees')

    sheet.columns = [
      { header: 'Employee_ID', key: 'Employee_ID', width: 15 },
      { header: 'Employee_Name', key: 'Employee_Name', width: 25 },
      { header: 'Email', key: 'Email', width: 25 },
      { header: 'Department', key: 'Department', width: 20 },
      { header: 'Business_Unit', key: 'Business_Unit', width: 20 },
      { header: 'Team_Name', key: 'Team_Name', width: 20 },
      { header: 'Position', key: 'Position', width: 20 },
      { header: 'Role_Level', key: 'Role_Level', width: 20 },
      { header: 'Reporting_Manager', key: 'Reporting_Manager', width: 20 },
      { header: 'Location', key: 'Location', width: 15 },
      { header: 'Status', key: 'Status', width: 10 }
    ]

    // Style header
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } }

    // Sample row
    sheet.addRow({
      Employee_ID: 'EMP001',
      Employee_Name: 'John Doe',
      Email: 'john@example.com',
      Department: 'Engineering',
      Business_Unit: 'Software Products',
      Team_Name: 'Frontend Team',
      Position: 'Frontend Engineer',
      Role_Level: 'Employee',
      Reporting_Manager: 'EMP002',
      Location: 'Mumbai',
      Status: 'Active'
    })

    const buffer = await workbook.xlsx.writeBuffer()
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', 'attachment; filename=employee_template.xlsx')
    return reply.send(buffer)
  })

  // Export employees to Excel
  app.get('/export', { onRequest: [app.authenticate] }, async (request, reply) => {
    const cId = request.query.companyId || request.user.companyId
    const employees = await prisma.employee.findMany({
      where: { companyId: cId },
      include: { department: true, position: true }
    })

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Employees')
    sheet.columns = [
      { header: 'Employee Code', key: 'employeeCode', width: 15 },
      { header: 'First Name', key: 'firstName', width: 15 },
      { header: 'Last Name', key: 'lastName', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Department', key: 'dept', width: 20 },
      { header: 'Position', key: 'pos', width: 20 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Date of Joining', key: 'doj', width: 18 }
    ]
    sheet.getRow(1).font = { bold: true }
    employees.forEach(e => {
      sheet.addRow({
        employeeCode: e.employeeCode, firstName: e.firstName, lastName: e.lastName,
        email: e.email, phone: e.phone,
        dept: e.department?.name, pos: e.position?.title,
        status: e.status, doj: e.dateOfJoining?.toISOString().split('T')[0]
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    reply.header('Content-Disposition', 'attachment; filename=employees_export.xlsx')
    return reply.send(buffer)
  })

  // Get reportees (org chart data)
  app.get('/:id/reportees', { onRequest: [app.authenticate] }, async (request, reply) => {
    const emp = await prisma.employee.findUnique({
      where: { id: request.params.id },
      include: {
        reportees: {
          include: {
            position: { select: { title: true, level: true } },
            department: { select: { name: true } },
            _count: { select: { reportees: true } }
          }
        }
      }
    })
    return reply.send({ success: true, data: emp?.reportees || [] })
  })

  // Full company org tree
  app.get('/org-tree', { onRequest: [app.authenticate] }, async (request, reply) => {
    const cId = request.query.companyId || request.user.companyId
    
    // Find top-level employees (no manager or manager is not in this company)
    const tops = await prisma.employee.findMany({
      where: { companyId: cId, managerId: null },
      include: {
        position: { select: { title: true, level: true } },
        department: { select: { name: true } }
      }
    })

    // Fetch all departments to resolve labels (BU, Department, Team)
    const depts = await prisma.department.findMany({
      where: { companyId: cId },
      select: { id: true, name: true, type: true, parentId: true }
    })
    const deptMap = Object.fromEntries(depts.map(d => [d.id, d]))

    const resolveHierarchy = (deptId) => {
      let current = deptMap[deptId]
      const result = { subteam: null, team: null, department: null, division: null }
      
      while (current) {
        if (current.type === 'SUBTEAM') result.subteam = current.name
        else if (current.type === 'TEAM') result.team = current.name
        else if (current.type === 'DEPARTMENT') result.department = current.name
        else if (current.type === 'DIVISION') result.division = current.name
        else if (current.type === 'BUSINESS_UNIT') result.division = current.name // back compat
        current = current.parentId ? deptMap[current.parentId] : null
      }
      return result
    }

    const all = await prisma.employee.findMany({
      where: { companyId: cId, status: 'ACTIVE' },
      select: {
        id: true, firstName: true, lastName: true, employeeCode: true,
        managerId: true, avatar: true, departmentId: true,
        position: { select: { title: true, level: true } },
        _count: { select: { reportees: true } }
      }
    })

    // Grouping by managerId for easy tree building
    const byManager = {}
    all.forEach(e => {
      // Add organizational hierarchy data
      const hierarchy = resolveHierarchy(e.departmentId)
      e.orgInfo = hierarchy

      const mid = e.managerId || 'ROOT'
      if (!byManager[mid]) byManager[mid] = []
      byManager[mid].push(e)
    })

    const buildTree = (managerId) => {
      const children = byManager[managerId] || []
      return children.map(c => ({
        ...c,
        children: buildTree(c.id)
      }))
    }

    const tree = buildTree('ROOT')
    return reply.send({ success: true, data: tree })
  })
}
