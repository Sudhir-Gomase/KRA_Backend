import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const counts = {
        employees: await prisma.employee.count(),
        companies: await prisma.company.count(),
        departments: await prisma.department.count(),
        positions: await prisma.position.count(),
        sampleEmployee: await prisma.employee.findFirst({ include: { company: true } })
    }
    console.log(JSON.stringify(counts, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
