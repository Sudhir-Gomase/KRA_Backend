import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// Specific Company ID from the session debug
const companyId = '0db38226-f9e2-4b21-9163-741dccf3989f'

const rawData = [
  { division: 'Executive', department: '', team: '', subteam: '', employeeCode: 'EMP001', firstName: 'Prashant', lastName: 'Shrivastva', email: 'prashant.srivastava@corp.com', jobRole: 'CEO', status: 'Active', manager: '' },
  { division: 'Executive', department: 'Business Development', team: '', subteam: '', employeeCode: 'EMP002', firstName: 'Saurav', lastName: 'Jain', email: 'saurabh.jain@corp.com', jobRole: 'Business Head', status: 'Active', manager: 'EMP001' },
  { division: 'Executive', department: 'Sales', team: '', subteam: '', employeeCode: 'EMP005', firstName: 'Pankaj', lastName: 'Pipariya', email: 'pankaj.pipariya@corp.com', jobRole: 'Sales Head', status: 'Active', manager: 'EMP001' },
  { division: 'Executive', department: 'CEO Office', team: '', subteam: '', employeeCode: 'EMP003', firstName: 'Diya', lastName: 'Dubey', email: 'diya.dubey@corp.com', jobRole: 'Chief of Staff', status: 'Active', manager: 'EMP001' },
  { division: 'Executive', department: 'Digital Marketing', team: '', subteam: '', employeeCode: 'EMP022', firstName: 'Saurav', lastName: 'Ghosh', email: 'digital03@corp.com', jobRole: 'Digital Marketing Associate', status: 'Active', manager: 'EMP001' },
  { division: 'Executive', department: 'Legal', team: '', subteam: '', employeeCode: 'EMP018', firstName: 'Maithili', lastName: 'Gala', email: 'legal@corp.com', jobRole: 'Legal & Accounts', status: 'Active', manager: 'EMP001' },
  { division: 'Executive', department: 'Human Science', team: '', subteam: '', employeeCode: 'EMP007', firstName: 'Hadiya', lastName: 'Hussain', email: 'hadiya.hussain@corp.com', jobRole: 'Associate Human Resource', status: 'Active', manager: 'EMP001' },
  { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: '', employeeCode: 'EMP006', firstName: 'Manish', lastName: 'Ukirade', email: 'developer01@corp.com', jobRole: 'Tech Lead', status: 'Active', manager: 'EMP002' },
  { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: 'Aps sub team', employeeCode: 'EMP008', firstName: 'Sudhir', lastName: 'Gomase', email: 'developer02@corp.com', jobRole: 'Sr. Backend Developer', status: 'Active', manager: 'EMP006' },
  { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: 'Dashboard sub team', employeeCode: 'EMP019', firstName: 'Zaheer', lastName: 'Shaikh', email: 'developer14@corp.com', jobRole: 'Sr. Software Developer', status: 'Active', manager: 'EMP006' },
  { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: 'Aps sub team', employeeCode: 'EMP025', firstName: 'Amit', lastName: 'Gadodiya', email: 'developer05@corp.com', jobRole: 'Senior Backend Developer', status: 'Active', manager: 'EMP008' },
  { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: 'Dashboard sub team', employeeCode: 'EMP012', firstName: 'Aryan', lastName: 'Shukla', email: 'developer04@corp.com', jobRole: 'Frontend Developer', status: 'Active', manager: 'EMP019' },
  { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: 'Dashboard sub team', employeeCode: 'EMP046', firstName: 'Ved', Goyal: '', lastName: 'Goyal', email: 'developer03@corp.com', jobRole: 'UI/UX Designer', status: 'Active', manager: 'EMP019' },
  { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: 'Aps sub team', employeeCode: 'EMP047', firstName: 'Aadit', lastName: 'Jha', email: 'developer06@corp.com', jobRole: 'Fullstack AI Engineer', status: 'Active', manager: 'EMP008' },
  { division: 'Executive', department: 'Business Development', team: 'Engineering Team', subteam: 'Aps sub team', employeeCode: 'EMP048', firstName: 'Swarangi', lastName: 'Shirsekar', email: 'developer07@corp.com', jobRole: 'Fullstack AI Engineer', status: 'Active', manager: 'EMP008' },
  { division: 'Executive', department: 'Business Development', team: 'Events Team', subteam: '', employeeCode: 'EMP044', firstName: 'Parth', lastName: 'Prajapati', email: 'we-awards@corp.com', jobRole: 'Business Awards Executive', status: 'Active', manager: 'EMP002' },
  { division: 'Executive', department: 'Sales', team: 'Sales Team', subteam: '', employeeCode: 'EMP004', firstName: 'Paree', lastName: 'Makwana', email: 'paree.makwana@corp.com', jobRole: 'Sales Head', status: 'Active', manager: 'EMP005' },
  { division: 'Executive', department: 'Sales', team: '', subteam: '', employeeCode: 'EMP041', firstName: 'Aayush', lastName: 'Saini', email: 'aayush.saini@corp.com', jobRole: 'Business Development Head', status: 'Active', manager: 'EMP005' },
  { division: 'Executive', department: 'Sales', team: 'Sales Team', subteam: '', employeeCode: 'EMP010', firstName: 'Nikhil', lastName: 'Sawant', email: 'nikhil.sawant@corp.com', jobRole: 'Client Growth Executive', status: 'Active', manager: 'EMP004' },
  { division: 'Executive', department: 'Sales', team: 'Sales Team', subteam: '', employeeCode: 'EMP021', firstName: 'Hitanshi', lastName: 'Thakkar', email: 'hitanshi.thakkar@corp.com', jobRole: 'Client Growth Executive', status: 'Active', manager: 'EMP004' },
  { division: 'Executive', department: 'Sales', team: 'Sales Team', subteam: '', employeeCode: 'EMP024', firstName: 'Vedant', lastName: 'Khamkar', email: 'vedant.khamkar@corp.com', jobRole: 'Client Growth Executive', status: 'Active', manager: 'EMP004' },
  { division: 'Executive', department: 'Digital Marketing', team: 'Marketing Team', subteam: '', employeeCode: 'EMP020', firstName: 'Mohanish', lastName: 'Gadhari', email: 'digital01@corp.com', jobRole: 'Digital Marketing Executive', status: 'Active', manager: 'EMP022' },
  { division: 'Executive', department: 'Human Resources', team: 'Human Resource Team', subteam: '', employeeCode: 'EMP050', firstName: 'Harshada', lastName: 'Natbhanjan', email: 'harshada.natbhanjan@corp.com', jobRole: 'HR Consultant', status: 'Active', manager: 'EMP011' },
  { division: 'Executive', department: 'Human Science', team: '', subteam: '', employeeCode: 'EMP043', firstName: 'Kamalavathi', lastName: 'Mudliyar', email: 'kamlavathi.mudliyar@corp.com', jobRole: 'HR Consultant', status: 'Active', manager: 'EMP007' },
  { division: 'Executive', department: 'Human Science', team: '', subteam: '', employeeCode: 'EMP009', firstName: 'Omkaar', lastName: 'Mhatre', email: 'we.support01@corp.com', jobRole: 'Data Analyst', status: 'Active', manager: 'EMP007' },
  { division: 'Executive', department: 'Human Resources', team: '', subteam: '', employeeCode: 'EMP011', firstName: 'Riya', lastName: 'Deshmukh', email: 'riya.deshmukh@corp.com', jobRole: 'HR Recruiter', status: 'Active', manager: 'EMP001' },
]

async function seed() {
    const createdDepts = {}

    const ensureDept = async (name, type, parentId = null) => {
        if (!name) return null
        const key = `${name.toLowerCase()}_${type}`
        if (createdDepts[key]) return createdDepts[key]
        
        let dept = await prisma.department.findFirst({
            where: { companyId, name, type, parentId }
        })
        if (!dept) {
            dept = await prisma.department.create({
                data: { companyId, name, type, parentId, isActive: true }
            })
        }
        createdDepts[key] = dept.id
        return dept.id
    }

    const posMap = {}
    const codeToId = {}

    console.log("Seeding hierarchy...")
    for (const row of rawData) {
        const divId = await ensureDept(row.division, 'DIVISION')
        const deptId = await ensureDept(row.department, 'DEPARTMENT', divId)
        const teamId = await ensureDept(row.team, 'TEAM', deptId)
        const subId = await ensureDept(row.subteam, 'SUBTEAM', teamId)
        
        row.finalDeptId = subId || teamId || deptId || divId

        const level = row.jobRole === 'CEO' ? 'CEO' : (row.jobRole.includes('Head') ? 'CXO' : 'Employee')
        const posKey = `${row.jobRole.toLowerCase()}_${level.toLowerCase()}`
        
        if (!posMap[posKey]) {
            let pos = await prisma.position.findFirst({
                where: { companyId, title: row.jobRole, level }
            })
            if (!pos) {
                pos = await prisma.position.create({
                    data: { companyId, title: row.jobRole, level, isActive: true }
                })
            }
            posMap[posKey] = pos.id
        }
        row.posId = posMap[posKey]
    }

    console.log("Upserting employees...")
    for (const row of rawData) {
        const emp = await prisma.employee.upsert({
            where: { companyId_employeeCode: { companyId, employeeCode: row.employeeCode } },
            update: {
                firstName: row.firstName,
                lastName: row.lastName,
                email: row.email,
                departmentId: row.finalDeptId,
                positionId: row.posId,
                status: row.status.toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
            },
            create: {
                companyId,
                employeeCode: row.employeeCode,
                firstName: row.firstName,
                lastName: row.lastName,
                email: row.email,
                departmentId: row.finalDeptId,
                positionId: row.posId,
                status: row.status.toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'
            }
        })
        codeToId[row.employeeCode] = emp.id
    }

    console.log("Linking managers...")
    for (const row of rawData) {
        if (row.manager && codeToId[row.manager]) {
            await prisma.employee.update({
                where: { id: codeToId[row.employeeCode] },
                data: { managerId: codeToId[row.manager] }
            })
        }
    }
    console.log("Done!")
}

seed().catch(console.error).finally(() => prisma.$disconnect())
