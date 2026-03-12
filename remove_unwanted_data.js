import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const companyId = '0db38226-f9e2-4b21-9163-741dccf3989f'

async function main() {
    console.log("Deleting unwanted data (WM- code series)...")
    
    // Deleting employees with 'WM-' series
    const deleted = await prisma.employee.deleteMany({
        where: {
            companyId,
            employeeCode: { contains: 'WM-' }
        }
    })
    
    console.log(`Successfully removed ${deleted.count} records.`)
    
    // Remaining count
    const remaining = await prisma.employee.count({ where: { companyId } })
    console.log(`Remaining employees: ${remaining}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
