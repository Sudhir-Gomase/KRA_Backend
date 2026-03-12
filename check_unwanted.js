import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const companyId = '0db38226-f9e2-4b21-9163-741dccf3989f'
    
    // Check if any employees with 'WM-' codes exist
    const wmEmployees = await prisma.employee.findMany({
        where: { 
            companyId,
            employeeCode: { contains: 'WM-' }
        },
        select: { id: true, employeeCode: true, firstName: true, lastName: true }
    })
    
    console.log("Employees with WM- codes found:", wmEmployees.length)
    if (wmEmployees.length > 0) {
        console.log("Sample WM- employees:", wmEmployees.slice(0, 5))
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
