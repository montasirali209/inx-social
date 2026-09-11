const bcrypt = require('bcryptjs');
const prisma = require('../src/db/prisma');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} must be set before running the administrator seed.`);
  return value;
}

async function main() {
  const email = required('ADMIN_EMAIL').toLowerCase();
  const password = required('ADMIN_PASSWORD');
  const name = String(process.env.ADMIN_NAME || 'INX Social Admin').trim();
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, role: 'SUPER_ADMIN', status: 'ACTIVE', passwordHash, emailVerifiedAt: new Date() },
    create: { email, name, role: 'SUPER_ADMIN', status: 'ACTIVE', passwordHash, emailVerifiedAt: new Date() }
  });

  await prisma.appSetting.upsert({
    where: { key: 'trial_days' },
    create: { key: 'trial_days', value: '5', description: 'Default trial length in days' },
    update: {}
  });

  await prisma.appSetting.upsert({
    where: { key: 'latest_desktop_version' },
    create: { key: 'latest_desktop_version', value: '13.15', description: 'Latest INX Social desktop release' },
    update: {}
  });

  await prisma.appSetting.upsert({
    where: { key: 'maintenance_mode' },
    create: { key: 'maintenance_mode', value: 'false', description: 'Set true to temporarily block desktop access' },
    update: {}
  });

  console.log(`Administrator seed complete for ${admin.email}. Password was not written to logs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
