import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const eCount = await prisma.employee.count()
    const dCount = await prisma.department.count()
    const pCount = await prisma.position.count()
    const linkedDept = await prisma.employee.count({ where: { departmentId: { not: null } } })
    const linkedPos = await prisma.employee.count({ where: { positionId: { not: null } } })
    
    console.log({ eCount, dCount, pCount, linkedDept, linkedPos })
}

main().catch(console.error).finally(() => prisma.$disconnect())
