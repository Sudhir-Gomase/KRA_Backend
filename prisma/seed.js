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
    { name: 'CLIENT_ADMIN', displayName: 'Client Admin', description: 'Full system access', permissions: { all: true } },
    { name: 'CEO', displayName: 'CEO', description: 'Company-wide OKR access', permissions: { okr: 'all', hrms: 'view' } },
    { name: 'CXO', displayName: 'CXO', description: 'C-Level OKR access', permissions: { okr: 'all', hrms: 'view' } },
    { name: 'MANAGER', displayName: 'Manager', description: 'Team management access', permissions: { okr: 'team', hrms: 'team' } },
    { name: 'FLM', displayName: 'Front Line Manager', description: 'Frontline manager access', permissions: { okr: 'team', hrms: 'team' } },
    { name: 'IC', displayName: 'Individual Contributor', description: 'Own OKR access', permissions: { okr: 'own' } }
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
    update: {},
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

  console.log('✅ OKR Cycle and objectives created')
  console.log('\n✨ Seeding complete!')
  console.log('📧 Admin: admin@corp.com | 🔑 Password: Admin@123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
