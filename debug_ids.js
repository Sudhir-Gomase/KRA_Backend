import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const employees = await prisma.employee.findMany({ 
        select: { id: true, firstName: true, companyId: true, employeeCode: true } 
    })
    const companies = await prisma.company.findMany()
    const users = await prisma.user.findMany({ 
        select: { id: true, email: true, companyId: true } 
    })
    
    console.log("Registered Companies:", companies.map(c => ({ id: c.id, name: c.name })))
    console.log("Users and associated Company IDs:", users.map(u => ({ email: u.email, companyId: u.companyId })))
    console.log("Total Employees found:", employees.length)
    if (employees.length > 0) {
        console.log("Sample Employee Company ID:", employees[0].companyId)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
