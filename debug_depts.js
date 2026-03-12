import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const depts = await prisma.department.findMany({ select: { name: true, type: true } })
    console.log(depts)
}

main().catch(console.error).finally(() => prisma.$disconnect())
