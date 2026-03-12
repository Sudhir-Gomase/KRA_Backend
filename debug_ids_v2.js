import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const user = await prisma.user.findFirst()
    const employee = await prisma.employee.findFirst()
    const company = await prisma.company.findFirst()
    
    console.log("Logged in User (sample):", { email: user?.email, companyId: user?.companyId })
    console.log("Employee (sample):", { code: employee?.employeeCode, companyId: employee?.companyId })
    console.log("Company (sample):", { id: company?.id, name: company?.name })
}

main().catch(console.error).finally(() => prisma.$disconnect())
