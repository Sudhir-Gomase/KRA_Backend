import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const user = await prisma.user.findFirst()
    const company = await prisma.company.findFirst()
    const employees = await prisma.employee.findMany({ select: { companyId: true, status: true }, take: 5 })
    
    console.log("Logged in User Company ID:", user?.companyId)
    console.log("Real Company ID:", company?.id)
    console.log("Employees Count:", (await prisma.employee.count()))
    console.log("Employees Sample (Company & Status):", employees.map(e => ({ cId: e.companyId, s: e.status })))
}

main().catch(console.error).finally(() => prisma.$disconnect())
