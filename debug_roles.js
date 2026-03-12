import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const roles = await prisma.userRole.findMany({ 
        include: { role: true } 
    })
    console.log(roles.map(r => ({ uId: r.userId, role: r.role.name })))
}

main().catch(console.error).finally(() => prisma.$disconnect())
