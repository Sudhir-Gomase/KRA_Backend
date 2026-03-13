import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create Corporate OS company
  const company = await prisma.company.upsert({
    where: { code: 'CORP-01' },
    update: {},
    create: {
      name: 'Corporate OS',
      code: 'CORP-01',
      industry: 'Technology',
      website: 'https://corp.com',
      email: 'admin@corp.com',
      phone: '+1 800 123 4567',
      address: 'Tech Plaza, Silicon Valley',
      city: 'Palo Alto',
      state: 'CA',
      country: 'USA'
    }
  })
  console.log('✅ Company: Corporate OS created')

  // Create roles
  const roleData = [
    { name: 'CLIENT_ADMIN', displayName: 'Client Admin', description: 'Full system access', permissions: { all: true, manage_permissions: true } },
    { name: 'CEO', displayName: 'CEO', description: 'Company-wide access', permissions: { okr: 'all', hrms: 'all', view_dashboard: true } },
    { name: 'CXO', displayName: 'CXO', description: 'C-Level access', permissions: { okr: 'all', hrms: 'view', view_dashboard: true } },
    { name: 'MANAGER', displayName: 'Manager', description: 'Team management access', permissions: { okr: 'team', hrms: 'team', manage_employees: true } },
    { name: 'FLM', displayName: 'Front Line Manager', description: 'Frontline manager access', permissions: { okr: 'team', hrms: 'team' } },
    { name: 'IC', displayName: 'Individual Contributor', description: 'Own OKR access', permissions: { okr: 'own', view_dashboard: true } }
  ]

  const roles = {}
  for (const r of roleData) {
    roles[r.name] = await prisma.role.upsert({
      where: { name: r.name },
      update: {},
      create: { ...r, permissions: JSON.stringify(r.permissions) }
    })
  }
  console.log('✅ Roles created')

  // Create departments
  const deptData = [
    { name: 'Executive', code: 'EXEC' },
    { name: 'Engineering', code: 'ENG' },
    { name: 'Product', code: 'PROD' },
    { name: 'Sales', code: 'SALES' },
    { name: 'Marketing', code: 'MKT' },
    { name: 'Human Resources', code: 'HR' },
    { name: 'Finance', code: 'FIN' },
    { name: 'Operations', code: 'OPS' }
  ]

  const depts = {}
  for (const d of deptData) {
    depts[d.code] = await prisma.department.upsert({
      where: { companyId_code: { companyId: company.id, code: d.code } },
      update: {},
      create: { ...d, companyId: company.id }
    })
  }
  console.log('✅ Departments created')

  // Create positions
  const posData = [
    { title: 'Chief Executive Officer', code: 'CEO', level: 'CEO', departmentId: depts['EXEC'].id },
    { title: 'Chief Technology Officer', code: 'CTO', level: 'CXO', departmentId: depts['EXEC'].id },
    { title: 'Chief Product Officer', code: 'CPO', level: 'CXO', departmentId: depts['EXEC'].id },
    { title: 'Engineering Manager', code: 'EM', level: 'MANAGER', departmentId: depts['ENG'].id },
    { title: 'Senior Software Engineer', code: 'SSE', level: 'FLM', departmentId: depts['ENG'].id },
    { title: 'Software Engineer', code: 'SE', level: 'IC', departmentId: depts['ENG'].id },
    { title: 'Product Manager', code: 'PM', level: 'MANAGER', departmentId: depts['PROD'].id },
    { title: 'Sales Manager', code: 'SM', level: 'MANAGER', departmentId: depts['SALES'].id },
    { title: 'HR Manager', code: 'HRM', level: 'MANAGER', departmentId: depts['HR'].id },
    { title: 'HR Executive', code: 'HRE', level: 'IC', departmentId: depts['HR'].id }
  ]

  const positions = {}
  for (const p of posData) {
    positions[p.code] = await prisma.position.create({
      data: { ...p, companyId: company.id }
    }).catch(() => prisma.position.findFirst({ where: { companyId: company.id, code: p.code } }))
  }
  console.log('✅ Positions created')

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin@123', 12)
  const adminEmp = await prisma.employee.upsert({
    where: { companyId_employeeCode: { companyId: company.id, employeeCode: 'EMP0001' } },
    update: {},
    create: {
      companyId: company.id,
      employeeCode: 'EMP0001',
      firstName: 'Super',
      lastName: 'Admin',
      email: 'admin@corp.com',
      phone: '+1 800 123 4567',
      gender: 'MALE',
      departmentId: depts['EXEC'].id,
      positionId: positions['CEO'].id,
      status: 'ACTIVE',
      employmentType: 'FULL_TIME',
      dateOfJoining: new Date('2020-01-01')
    }
  })

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@corp.com' },
    update: {
      password: adminPassword,
      isActive: true,
      firstName: 'Super',
      lastName: 'Admin',
      employeeId: adminEmp.id
    },
    create: {
      companyId: company.id,
      employeeId: adminEmp.id,
      email: 'admin@corp.com',
      password: adminPassword,
      firstName: 'Super',
      lastName: 'Admin'
    }
  })

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: roles['CLIENT_ADMIN'].id } },
    update: {},
    create: { userId: adminUser.id, roleId: roles['CLIENT_ADMIN'].id }
  })
  console.log('✅ Admin user created: admin@corp.com / Admin@123')

  // Create sample employees
  const sampleEmps = [
    { code: 'EMP0002', firstName: 'Rahul', lastName: 'Sharma', email: 'rahul@corp.com', deptCode: 'ENG', posCode: 'EM', role: 'MANAGER' },
    { code: 'EMP0003', firstName: 'Priya', lastName: 'Patel', email: 'priya@corp.com', deptCode: 'ENG', posCode: 'SE', role: 'IC' },
    { code: 'EMP0004', firstName: 'Amit', lastName: 'Kumar', email: 'amit@corp.com', deptCode: 'PROD', posCode: 'PM', role: 'MANAGER' },
    { code: 'EMP0005', firstName: 'Sneha', lastName: 'Gupta', email: 'sneha@corp.com', deptCode: 'SALES', posCode: 'SM', role: 'FLM' },
    { code: 'EMP0006', firstName: 'Vikram', lastName: 'Singh', email: 'vikram@corp.com', deptCode: 'HR', posCode: 'HRM', role: 'MANAGER' }
  ]

  const defaultPass = await bcrypt.hash('Welcome@123', 12)
  for (const e of sampleEmps) {
    const emp = await prisma.employee.upsert({
      where: { companyId_employeeCode: { companyId: company.id, employeeCode: e.code } },
      update: {},
      create: {
        companyId: company.id, employeeCode: e.code,
        firstName: e.firstName, lastName: e.lastName, email: e.email,
        departmentId: depts[e.deptCode].id,
        positionId: positions[e.posCode]?.id,
        managerId: adminEmp.id,
        status: 'ACTIVE', employmentType: 'FULL_TIME',
        dateOfJoining: new Date('2023-01-01')
      }
    })
    const user = await prisma.user.upsert({
      where: { email: e.email },
      update: {},
      create: {
        companyId: company.id, employeeId: emp.id,
        email: e.email, password: defaultPass,
        firstName: e.firstName, lastName: e.lastName
      }
    })
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roles[e.role].id } },
      update: {},
      create: { userId: user.id, roleId: roles[e.role].id }
    })
  }
  console.log('✅ Sample employees created (password: Welcome@123)')

  // Create OKR Cycle
  const cycle = await prisma.okrCycle.create({
    data: {
      companyId: company.id,
      name: 'Q1 2026',
      type: 'QUARTERLY',
      year: 2026,
      quarter: 1,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: 'ACTIVE'
    }
  }).catch(e => prisma.okrCycle.findFirst({ where: { companyId: company.id, name: 'Q1 2026' } }))

  // Create sample objectives
  const companyObj = await prisma.objective.create({
    data: {
      cycleId: cycle.id,
      ownerId: adminEmp.id,
      title: 'Achieve Market Leadership in HRMS Segment',
      description: 'Become the #1 HRMS provider in the SME segment by Q4 2026',
      type: 'COMPANY',
      level: 'CEO',
      status: 'ON_TRACK',
      progress: 35
    }
  }).catch(() => null)

  if (companyObj) {
    await prisma.keyResult.createMany({
      data: [
        {
          objectiveId: companyObj.id,
          title: 'Acquire 500 new enterprise clients',
          type: 'NUMBER', unit: 'clients',
          startValue: 0, targetValue: 500, currentValue: 175,
          progress: 35, status: 'ON_TRACK'
        },
        {
          objectiveId: companyObj.id,
          title: 'Achieve 95% customer satisfaction score',
          type: 'PERCENTAGE',
          startValue: 80, targetValue: 95, currentValue: 87,
          progress: 47, status: 'ON_TRACK'
        },
        {
          objectiveId: companyObj.id,
          title: 'Grow ARR to ₹10 Crore',
          type: 'CURRENCY', unit: 'INR',
          startValue: 0, targetValue: 10000000, currentValue: 3500000,
          progress: 35, status: 'ON_TRACK'
        }
      ]
    })
  }

  // ---------- Seed We Matter org structure & employees ----------
  const wemCompany = await prisma.company.upsert({
    where: { code: 'WEM-01' },
    update: {},
    create: {
      name: 'We Matter HRMS',
      code: 'WEM-01',
      industry: 'Services',
      website: 'https://we-matter.com',
      email: 'info@we-matter.com',
      phone: '+91 00000 00000',
      address: 'India',
      city: 'Mumbai',
      country: 'India'
    }
  })

  const wemRows = [
    { division: 'Executive', department: '', team: '', subteam: '', employeeCode: 'WEM001', firstName: 'Prashant', lastName: 'Shrivastva', email: 'prashant.srivastava@we-matter.com', jobRole: 'CEO', status: 'ACTIVE', reportingManager: '', hireDate: '1/12/2025' },
    { division: 'Executive', department: 'Business Development', team: '', subteam: '', employeeCode: 'WEM002', firstName: 'Saurav', lastName: 'Jain', email: 'saurabh.jain@we-matter.com', jobRole: 'Business Head', status: 'ACTIVE', reportingManager: 'WEM001', hireDate: '2/12/2025' },
    { division: 'Executive', department: 'Sales', team: '', subteam: '', employeeCode: 'WEM005', firstName: 'Pankaj', lastName: 'Pipariya', email: 'pankaj.pipariya@we-matter.com', jobRole: 'Sales Head', status: 'ACTIVE', reportingManager: 'WEM001', hireDate: '3/12/2025' },
    { division: 'Executive', department: 'CEO Office', team: '', subteam: '', employeeCode: 'WEM003', firstName: 'Diya', lastName: 'Dubey', email: 'diya.dubey@we-matter.com', jobRole: 'Chief of Staff', status: 'ACTIVE', reportingManager: 'WEM001', hireDate: '7/12/2025' },
    { division: 'Executive', department: 'Digital Marketing', team: '', subteam: '', employeeCode: 'WEM022', firstName: 'Saurav', lastName: 'Ghosh', email: 'digital03@we-matter.com', jobRole: 'Digital Marketing Associate', status: 'ACTIVE', reportingManager: 'WEM001', hireDate: '12-18-2025' },
    { division: 'Executive', department: 'Legal', team: '', subteam: '', employeeCode: 'WEM018', firstName: 'Maithili', lastName: 'Gala', email: 'legal@we-matter.com', jobRole: 'Legal & Accounts', status: 'ACTIVE', reportingManager: 'WEM001', hireDate: '12-21-2025' },
    { division: 'Executive', department: 'Human Science', team: '', subteam: '', employeeCode: 'WEM007', firstName: 'Hadiya', lastName: 'Hussain', email: 'hadiya.hussain@we-matter.com', jobRole: 'Associate Human Resource', status: 'ACTIVE', reportingManager: 'WEM001', hireDate: '9/12/2025' },
    { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: '', employeeCode: 'WEM006', firstName: 'Manish', lastName: 'Ukirade', email: 'developer01@we-matter.com', jobRole: 'Tech Lead', status: 'ACTIVE', reportingManager: 'WEM002', hireDate: '4/12/2025' },
    { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: 'Aps sub team', employeeCode: 'WEM008', firstName: 'Sudhir', lastName: 'Gomase', email: 'developer02@we-matter.com', jobRole: 'Sr. Backend Developer', status: 'ACTIVE', reportingManager: 'WEM006', hireDate: '10/12/2025' },
    { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: 'Dashboard sub team', employeeCode: 'WEM019', firstName: 'Zaheer', lastName: 'Shaikh', email: 'developer14@we-matter.com', jobRole: 'Sr. Software Developer', status: 'ACTIVE', reportingManager: 'WEM006', hireDate: '12-15-2025' },
    { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: 'Aps sub team', employeeCode: 'WEM025', firstName: 'Amit', lastName: 'Gadodiya', email: 'developer05@we-matter.com', jobRole: 'Senior Backend Developer', status: 'ACTIVE', reportingManager: 'WEM008', hireDate: '12-17-2025' },
    { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: 'Dashboard sub team', employeeCode: 'WEM012', firstName: 'Aryan', lastName: 'Shukla', email: 'developer04@we-matter.com', jobRole: 'Frontend Developer', status: 'ACTIVE', reportingManager: 'WEM019', hireDate: '12-14-2025' },
    { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: 'Dashboard sub team', employeeCode: 'WEM046', firstName: 'Ved', lastName: 'Goyal', email: 'developer03@we-matter.com', jobRole: 'UI/UX Designer', status: 'ACTIVE', reportingManager: 'WEM019', hireDate: '12-22-2025' },
    { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: 'Aps sub team', employeeCode: 'WEM047', firstName: 'Aadit', lastName: 'Jha', email: 'developer06@we-matter.com', jobRole: 'Fullstack AI Engineer', status: 'ACTIVE', reportingManager: 'WEM008', hireDate: '12-24-2025' },
    { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: 'Aps sub team', employeeCode: 'WEM048', firstName: 'Swarangi', lastName: 'Shirsekar', email: 'developer07@we-matter.com', jobRole: 'Fullstack AI Engineer', status: 'ACTIVE', reportingManager: 'WEM008', hireDate: '12-25-2025' },
    { division: 'Executive', department: 'Business Development', team: 'Events Team', subteam: '', employeeCode: 'WEM044', firstName: 'Parth', lastName: 'Prajapati', email: 'we-awards@we-matter.com', jobRole: 'Business Awards Executive', status: 'ACTIVE', reportingManager: 'WEM002', hireDate: '12-23-2025' },
    { division: 'Executive', department: 'Sales', team: 'Sales Team', subteam: '', employeeCode: 'WEM004', firstName: 'Paree', lastName: 'Makwana', email: 'paree.makwana@we-matter.com', jobRole: 'Sales Head', status: 'ACTIVE', reportingManager: 'WEM005', hireDate: '8/12/2025' },
    { division: 'Executive', department: 'Sales', team: '', subteam: '', employeeCode: 'WEM041', firstName: 'Aayush', lastName: 'Saini', email: 'aayush.saini@we-matter.com', jobRole: 'Business Development Head', status: 'ACTIVE', reportingManager: 'WEM005', hireDate: '12-26-2025' },
    { division: 'Executive', department: 'Sales', team: 'Sales Team', subteam: '', employeeCode: 'WEM010', firstName: 'Nikhil', lastName: 'Sawant', email: 'nikhil.sawant@we-matter.com', jobRole: 'Client Growth Executive', status: 'ACTIVE', reportingManager: 'WEM004', hireDate: '5/12/2025' },
    { division: 'Executive', department: 'Sales', team: 'Sales Team', subteam: '', employeeCode: 'WEM021', firstName: 'Hitanshi', lastName: 'Thakkar', email: 'hitanshi.thakkar@we-matter.com', jobRole: 'Client Growth Executive', status: 'ACTIVE', reportingManager: 'WEM004', hireDate: '12-16-2025' },
    { division: 'Executive', department: 'Sales', team: 'Sales Team', subteam: '', employeeCode: 'WEM024', firstName: 'Vedant', lastName: 'Khamkar', email: 'vedant.khamkar@we-matter.com', jobRole: 'Client Growth Executive', status: 'ACTIVE', reportingManager: 'WEM004', hireDate: '12-19-2025' },
    { division: 'Executive', department: 'Digital Marketing', team: 'Marketing Team', subteam: '', employeeCode: 'WEM020', firstName: 'Mohanish', lastName: 'Gadhari', email: 'digital01@we-matter.com', jobRole: 'Digital Marketing Executive', status: 'ACTIVE', reportingManager: 'WEM022', hireDate: '12-13-2025' },
    { division: 'Executive', department: 'Human Resources', team: 'Human Resource Team', subteam: '', employeeCode: 'WEM050', firstName: 'Harshada', lastName: 'Natbhanjan', email: 'harshada.natbhanjan@we-matter.com', jobRole: 'HR Consultant', status: 'ACTIVE', reportingManager: 'WEM011', hireDate: '12/12/2025' },
    { division: 'Executive', department: 'Human Science', team: '', subteam: '', employeeCode: 'WEM043', firstName: 'Kamalavathi', lastName: 'Mudliyar', email: 'kamlavathi.mudliyar@we-matter.com', jobRole: 'HR Consultant', status: 'ACTIVE', reportingManager: 'WEM007', hireDate: '12-20-2025' },
    { division: 'Executive', department: 'Human Science', team: '', subteam: '', employeeCode: 'WEM009', firstName: 'Omkaar', lastName: 'Mhatre', email: 'we.support01@we-matter.com', jobRole: 'Data Analyst', status: 'ACTIVE', reportingManager: 'WEM007', hireDate: '11/12/2025' },
    { division: 'Executive', department: 'Human Resources', team: '', subteam: '', employeeCode: 'WEM011', firstName: 'Riya', lastName: 'Deshmukh', email: 'riya.deshmukh@we-matter.com', jobRole: 'HR Recruiter', status: 'ACTIVE', reportingManager: 'WEM001', hireDate: '6/12/2025' },
  ]

  const deptCache = {}
  function makeCode(name) {
    return name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 16)
  }
  function parseWemDate(s) {
    if (!s) return undefined
    if (s.includes('/')) {
      const [d, m, y] = s.split('/')
      return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
    }
    if (s.includes('-')) {
      const [m, d, y] = s.split('-')
      return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`)
    }
    return undefined
  }

  async function ensureDeptPath(row) {
    const levels = [
      { value: row.division, type: 'DIVISION' },
      { value: row.department, type: 'DEPARTMENT' },
      { value: row.team, type: 'TEAM' },
      { value: row.subteam, type: 'SUBTEAM' },
    ]
    let parentId = null
    let lastId = null

    for (const level of levels) {
      if (!level.value) continue
      const key = `${level.value}|${parentId || 'root'}`
      if (deptCache[key]) {
        parentId = deptCache[key].id
        lastId = parentId
        continue
      }
      const code = makeCode(level.value)
      const dept = await prisma.department.upsert({
        where: { companyId_code: { companyId: wemCompany.id, code } },
        update: {},
        create: {
          companyId: wemCompany.id,
          parentId,
          name: level.value,
          code,
          type: level.type,
        },
      })
      deptCache[key] = dept
      parentId = dept.id
      lastId = dept.id
    }
    return lastId
  }

  const positionCache = {}
  const wemEmpByCode = {}

  // First pass: create departments, positions, employees without manager links
  for (const row of wemRows) {
    const deptId = await ensureDeptPath(row)
    const posKey = row.jobRole || 'Employee'
    let pos = positionCache[posKey]
    if (!pos) {
      pos = await prisma.position.create({
        data: {
          companyId: wemCompany.id,
          departmentId: deptId,
          title: row.jobRole || 'Employee',
          level: undefined,
        },
      })
      positionCache[posKey] = pos
    }

    const emp = await prisma.employee.upsert({
      where: { companyId_employeeCode: { companyId: wemCompany.id, employeeCode: row.employeeCode } },
      update: {
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        status: row.status || 'ACTIVE',
        departmentId: deptId,
        positionId: pos.id,
        dateOfJoining: parseWemDate(row.hireDate) || new Date('2025-12-01'),
      },
      create: {
        companyId: wemCompany.id,
        employeeCode: row.employeeCode,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        status: row.status || 'ACTIVE',
        employmentType: 'FULL_TIME',
        departmentId: deptId,
        positionId: pos.id,
        dateOfJoining: parseWemDate(row.hireDate) || new Date('2025-12-01'),
      },
    })
    wemEmpByCode[row.employeeCode] = emp
  }

  // Second pass: wire reporting manager
  for (const row of wemRows) {
    if (!row.reportingManager) continue
    const emp = wemEmpByCode[row.employeeCode]
    const mgr = wemEmpByCode[row.reportingManager]
    if (emp && mgr && emp.managerId !== mgr.id) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { managerId: mgr.id },
      })
    }
  }

  // Create CLIENT_ADMIN user for support email
  const wemSupportEmp = wemEmpByCode['WEM009']
  if (wemSupportEmp) {
    const supportPassword = await bcrypt.hash('Welcome@123', 12)
    const wemSupportUser = await prisma.user.upsert({
      where: { email: 'we.support01@we-matter.com' },
      update: {
        isCxo: true,
        firstName: wemSupportEmp.firstName,
        lastName: wemSupportEmp.lastName,
        employeeId: wemSupportEmp.id,
        isActive: true,
      },
      create: {
        companyId: wemCompany.id,
        employeeId: wemSupportEmp.id,
        email: 'we.support01@we-matter.com',
        password: supportPassword,
        firstName: wemSupportEmp.firstName,
        lastName: wemSupportEmp.lastName,
        isCxo: true,
      },
    })
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: wemSupportUser.id, roleId: roles['CLIENT_ADMIN'].id } },
      update: {},
      create: { userId: wemSupportUser.id, roleId: roles['CLIENT_ADMIN'].id },
    })
    console.log('✅ We Matter support user set as CLIENT_ADMIN: we.support01@we-matter.com / Welcome@123')
  }

  console.log('✅ OKR Cycle and objectives created')
  console.log('\n✨ Seeding complete!')
  console.log('📧 Admin: admin@corp.com | 🔑 Password: Admin@123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
