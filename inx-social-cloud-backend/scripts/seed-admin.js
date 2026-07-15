const bcrypt = require('bcryptjs');
const prisma = require('../src/db/prisma');

async function main() {
  const email = process.env.ADMIN_EMAIL || 'admin@inxsocial.local';
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const name = process.env.ADMIN_NAME || 'INX Social Admin';
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, role: 'SUPER_ADMIN', status: 'ACTIVE', passwordHash, emailVerifiedAt: new Date() },
    create: { email, name, role: 'SUPER_ADMIN', status: 'ACTIVE', passwordHash, emailVerifiedAt: new Date() }
  });

  await prisma.appSetting.upsert({
    where: { key: 'trial_days' },
    create: { key: 'trial_days', value: '5', description: 'Default trial length in days' },
    update: { value: '5' }
  });

  await prisma.appSetting.upsert({
    where: { key: 'latest_desktop_version' },
    create: { key: 'latest_desktop_version', value: '13.15', description: 'Latest INX Social desktop release' },
    update: { value: '13.15' }
  });

  await prisma.appSetting.upsert({
    where: { key: 'maintenance_mode' },
    create: { key: 'maintenance_mode', value: 'false', description: 'Set true to temporarily block desktop access' },
    update: { value: 'false' }
  });

  console.log(`Seed complete. Admin: ${admin.email} / ${password}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
