import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const companyId = '0db38226-f9e2-4b21-9163-741dccf3989f'
    
    const [e, d, p] = await Promise.all([
        prisma.employee.count({ where: { companyId } }),
        prisma.department.count({ where: { companyId } }),
        prisma.position.count({ where: { companyId } })
    ])
    
    console.log(`Final Counts for Company ${companyId}:`)
    console.log(`Employees: ${e}`)
    console.log(`Departments/Units: ${d}`)
    console.log(`Positions: ${p}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
