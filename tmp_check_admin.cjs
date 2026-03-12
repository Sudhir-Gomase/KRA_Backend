const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdmin() {
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@corp.com' }
  });
  console.log('Admin user exists:', !!admin);
  if (admin) {
    console.log('Admin is active:', admin.isActive);
  }
  
  const allUsers = await prisma.user.findMany({ select: { email: true } });
  console.log('All user emails:', allUsers.map(u => u.email).join(', '));
  
  await prisma.$disconnect();
}

checkAdmin().catch(console.error);
