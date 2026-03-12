import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const user = await prisma.user.findFirst()
    const employee = await prisma.employee.findFirst()
    const matches = (user?.companyId === employee?.companyId)
    
    console.log("User Company ID:", user?.companyId)
    console.log("Employee Company ID:", employee?.companyId)
    console.log("Match:", matches)
    console.log("Total Count where match:", (await prisma.employee.count({ where: { companyId: user?.companyId } })))
}

main().catch(console.error).finally(() => prisma.$disconnect())
