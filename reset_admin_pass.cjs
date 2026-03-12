const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function resetPassword() {
  const email = 'admin@wematter.in';
  const newPassword = 'Admin@123';
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  
  const user = await prisma.user.update({
    where: { email },
    data: { 
      password: hashedPassword,
      isActive: true
    }
  });
  
  console.log(`Password reset successful for ${email}`);
  await prisma.$disconnect();
}

resetPassword().catch(console.error);
