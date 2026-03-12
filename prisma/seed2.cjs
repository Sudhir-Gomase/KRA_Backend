const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing old data...');
  await prisma.kraComment.deleteMany();
  await prisma.kraHistory.deleteMany();
  await prisma.kraCheckin.deleteMany();
  await prisma.kraTask.deleteMany();
  await prisma.kraBlocker.deleteMany();
  await prisma.actionPlan.deleteMany();
  await prisma.keyResult.deleteMany();
  await prisma.objective.deleteMany();
  await prisma.appraisalFeedback.deleteMany();
  await prisma.appraisalCycle.deleteMany();
  await prisma.okrCycle.deleteMany();
  
  await prisma.employee.deleteMany();
  await prisma.position.deleteMany();
  // Set department head and parent to null before deleting
  await prisma.department.updateMany({ data: { headId: null, parentId: null } });
  await prisma.department.deleteMany();
  
  // Clean all non-admin users basically to refresh properly without crashing constraint
  await prisma.user.deleteMany({
    where: { email: { not: 'admin@corp.com' } }
  });

  const company = await prisma.company.findFirst() || await prisma.company.create({
    data: { name: 'Corporate OS', website: 'corp.com', industry: 'Technology', code: 'CORP' }
  });

  const roles = ['CLIENT_ADMIN', 'CEO', 'CXO', 'MANAGER', 'FLM', 'IC'];
  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r },
      update: {},
      create: { name: r, displayName: r.replace('_', ' '), description: r }
    });
  }

  // Create Departments
  const cSuite = await prisma.department.create({ data: { name: 'Executive', code: 'EXEC', companyId: company.id } });
  const engDept = await prisma.department.create({ data: { name: 'Engineering', code: 'ENG', companyId: company.id } });
  const salesDept = await prisma.department.create({ data: { name: 'Sales', code: 'SALES', companyId: company.id } });
  const hrDept = await prisma.department.create({ data: { name: 'Human Resources', code: 'HR', companyId: company.id } });

  // Create Positions
  const posCEO = await prisma.position.create({ data: { title: 'Chief Executive Officer', code: 'CEO', level: 'CEO', companyId: company.id } });
  const posTechHead = await prisma.position.create({ data: { title: 'Product & Tech Head', code: 'TECH_HEAD', level: 'CXO', companyId: company.id } });
  const posSalesHead = await prisma.position.create({ data: { title: 'Sales Head', code: 'SALES_HEAD', level: 'CXO', companyId: company.id } });
  const posTechLead = await prisma.position.create({ data: { title: 'Tech Lead', code: 'TECH_LEAD', level: 'MANAGER', companyId: company.id } });
  const posSalesLead = await prisma.position.create({ data: { title: 'Sales Lead', code: 'SALES_LEAD', level: 'MANAGER', companyId: company.id } });
  const posSrDev = await prisma.position.create({ data: { title: 'Sr. Backend Developer', code: 'SR_DEV', level: 'FLM', companyId: company.id } });
  const posJrDev = await prisma.position.create({ data: { title: 'Junior Developer', code: 'JR_DEV', level: 'IC', companyId: company.id } });
  const posFullstack = await prisma.position.create({ data: { title: 'Fullstack Engineer', code: 'FS_DEV', level: 'IC', companyId: company.id } });
  const posSalesExec = await prisma.position.create({ data: { title: 'Client Growth Executive', code: 'SALES_EXEC', level: 'IC', companyId: company.id } });

  const pwd = await bcrypt.hash('defaultPassword@123', 10);
  const getAvatar = (name) => `https://api.dicebear.com/9.x/micah/svg?seed=${name.split(' ')[0]}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  const createUserEmployee = async (firstName, lastName, email, roleName, posId, deptId, managerId) => {
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    const emp = await prisma.employee.create({
      data: {
        companyId: company.id, firstName, lastName, email,
        employeeCode: `CORP-${Math.floor(Math.random() * 10000) + 1000}`,
        status: 'ACTIVE', departmentId: deptId, positionId: posId,
        managerId: managerId,
        avatar: getAvatar(firstName)
      }
    });
    
    const user = await prisma.user.create({
      data: {
        email, password: pwd, firstName, lastName, isActive: true,
        companyId: company.id, employeeId: emp.id,
        avatar: getAvatar(firstName),
        userRoles: { create: [{ roleId: role.id }] }
      }
    });

    if (!managerId) {
       await prisma.department.update({ where: { id: deptId }, data: { headId: emp.id } });
    }
    return { user, emp };
  };

  console.log('Creating users...');
  // CEO
  const ceo = await createUserEmployee('Poonam', 'Shrivastava', 'poonam.shrivastava@corp.com', 'CEO', posCEO.id, cSuite.id, null);
  
  // CXOs
  const techHead = await createUserEmployee('Sumit', 'Jain', 'sumit.jain@corp.com', 'CXO', posTechHead.id, engDept.id, ceo.emp.id);
  const salesHead = await createUserEmployee('Prashant', 'Bhargava', 'prashant.bhargava@corp.com', 'CXO', posSalesHead.id, salesDept.id, ceo.emp.id);

  await prisma.department.update({ where: { id: engDept.id }, data: { parentId: cSuite.id } });
  await prisma.department.update({ where: { id: salesDept.id }, data: { parentId: cSuite.id } });

  // Managers
  const techLead = await createUserEmployee('Anshul', 'Sharma', 'anshul.sharma@corp.com', 'MANAGER', posTechLead.id, engDept.id, techHead.emp.id);
  const salesLead = await createUserEmployee('Ritika', 'Sharma', 'ritika.sharma@corp.com', 'MANAGER', posSalesLead.id, salesDept.id, salesHead.emp.id);

  // FLMs
  const backLead = await createUserEmployee('Sanket', 'Ganaco', 'sanket.ganaco@corp.com', 'FLM', posSrDev.id, engDept.id, techLead.emp.id);
  const frontLead = await createUserEmployee('Zakeer', 'Shaikh', 'zakeer.shaikh@corp.com', 'FLM', posSrDev.id, engDept.id, techLead.emp.id);

  // ICs Tech
  const u1 = await createUserEmployee('Ankit', 'Gudade', 'ankit.gudade@corp.com', 'IC', posJrDev.id, engDept.id, backLead.emp.id);
  const u2 = await createUserEmployee('Aadil', 'Jha', 'aadil.jha@corp.com', 'IC', posFullstack.id, engDept.id, backLead.emp.id);
  const u3 = await createUserEmployee('Sourav', 'Haldar', 'sourav.haldar@corp.com', 'IC', posFullstack.id, engDept.id, backLead.emp.id);
  
  // ICs Sales
  const s1 = await createUserEmployee('Hitakshi', 'Khanna', 'hitakshi.khanna@corp.com', 'IC', posSalesExec.id, salesDept.id, salesLead.emp.id);
  const s2 = await createUserEmployee('Pranjal', 'Thakkar', 'pranjal.thakkar@corp.com', 'IC', posSalesExec.id, salesDept.id, salesLead.emp.id);
  const s3 = await createUserEmployee('Vedant', 'Kadam', 'vedant.kadam@corp.com', 'IC', posSalesExec.id, salesDept.id, salesLead.emp.id);

  console.log('Creating OKRs...');
  const cycle = await prisma.okrCycle.create({
    data: {
      companyId: company.id, name: 'Q1 2026', type: 'QUARTERLY', year: 2026, quarter: 1,
      startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'),
      status: 'ACTIVE'
    }
  });

  // Cross functional Goal (Company Level)
  const obj1 = await prisma.objective.create({
    data: {
      cycleId: cycle.id, companyId: company.id, title: 'Drive Q1 Revenue & Tech Modernization', type: 'COMPANY', level: 'CEO',
      ownerId: ceo.emp.id, status: 'IN_PROGRESS', progress: 45
    }
  });

  const kr1 = await prisma.keyResult.create({
    data: {
      objectiveId: obj1.id, ownerId: salesHead.emp.id, title: 'Achieve $2M in ARR', type: 'NUMBER',
      targetValue: 2000000, currentValue: 1200000, unit: 'USD', progress: 60
    }
  });
  const kr2 = await prisma.keyResult.create({
    data: {
      objectiveId: obj1.id, ownerId: techHead.emp.id, title: 'Release new HRMS V2 to production', type: 'PERCENTAGE',
      targetValue: 100, currentValue: 30, progress: 30
    }
  });

  // Department Goal: Sales
  const objSales = await prisma.objective.create({
    data: {
      cycleId: cycle.id, companyId: company.id, parentId: obj1.id, departmentId: salesDept.id, title: 'Expand Enterprise Accounts', type: 'DEPARTMENT', level: 'CXO',
      ownerId: salesHead.emp.id, status: 'IN_PROGRESS', progress: 50
    }
  });
  await prisma.keyResult.create({
    data: {
      objectiveId: objSales.id, ownerId: salesHead.emp.id, title: 'Close 5 new enterprise deals', type: 'NUMBER',
      targetValue: 5, currentValue: 2, progress: 40
    }
  });

  // Department Goal: Tech
  const objTech = await prisma.objective.create({
    data: {
      cycleId: cycle.id, companyId: company.id, parentId: obj1.id, departmentId: engDept.id, title: 'Enhance Platform Scalability', type: 'DEPARTMENT', level: 'CXO',
      ownerId: techHead.emp.id, status: 'IN_PROGRESS', progress: 55
    }
  });
  const techKR = await prisma.keyResult.create({
    data: {
      objectiveId: objTech.id, ownerId: techLead.emp.id, title: 'Reduce API latency by 50%', type: 'NUMBER',
      targetValue: 50, currentValue: 20, progress: 40 
    }
  });

  // Manager Goal: Tech
  const objTechLead = await prisma.objective.create({
    data: {
      cycleId: cycle.id, companyId: company.id, parentId: objTech.id, departmentId: engDept.id, title: 'Optimize Database Queries', type: 'TEAM', level: 'MANAGER',
      ownerId: techLead.emp.id, status: 'BEHIND', progress: 25
    }
  });
  const teamKR = await prisma.keyResult.create({
    data: {
      objectiveId: objTechLead.id, ownerId: backLead.emp.id, title: 'Index 100% of slow queries', type: 'PERCENTAGE',
      targetValue: 100, currentValue: 25, progress: 25
    }
  });

  // Action Plans & Tasks
  const ap1 = await prisma.actionPlan.create({
    data: {
      keyResultId: teamKR.id, title: 'Analyze Query Logs', status: 'IN_PROGRESS'
    }
  });

  const task1 = await prisma.kraTask.create({
    data: {
      actionPlanId: ap1.id, title: 'Download AWS RDS slow query logs', assigneeId: u1.emp.id,
      status: 'DONE', priority: 'HIGH', dueDate: new Date('2026-03-01')
    }
  });
  
  const task2 = await prisma.kraTask.create({
    data: {
      actionPlanId: ap1.id, title: 'Identify top 10 bottlenecks', assigneeId: u2.emp.id,
      status: 'IN_PROGRESS', priority: 'CRITICAL', dueDate: new Date('2026-03-15')
    }
  });

  // Add Blocker
  await prisma.kraBlocker.create({
    data: {
      keyResultId: teamKR.id, reportedById: u2.emp.id, taskId: task2.id, title: 'No access to production DB logs',
      description: 'Need IAM permissions to access cloudwatch logs for the replica DB.', severity: 'CRITICAL', status: 'OPEN'
    }
  });

  // IC Goal: Sales
  const objIC = await prisma.objective.create({
    data: {
      cycleId: cycle.id, companyId: company.id, parentId: objSales.id, departmentId: salesDept.id, title: 'Q1 Sales Quota', type: 'INDIVIDUAL', level: 'IC',
      ownerId: s1.emp.id, status: 'ON_TRACK', progress: 80
    }
  });
  await prisma.keyResult.create({
    data: {
      objectiveId: objIC.id, ownerId: s1.emp.id, title: 'Generate 50 SQLs', type: 'NUMBER',
      targetValue: 50, currentValue: 40, progress: 80
    }
  });

  console.log('Dummy data seeded beautifully! Accounts created with defaultPassword@123');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
