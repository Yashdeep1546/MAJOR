import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Seeding database...');

  // Create default user
  const user = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Default User',
      email: 'user@aether.local',
    },
  });
  console.log('  ✓ User:', user.name);

  // Create sample tasks
  const tasks = [
    { title: 'Review project architecture', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const },
    { title: 'Set up CI/CD pipeline', priority: 'MEDIUM' as const, status: 'TODO' as const },
    { title: 'Write unit tests for task service', priority: 'HIGH' as const, status: 'TODO' as const },
  ];

  for (const t of tasks) {
    await prisma.task.create({
      data: { ...t, userId: user.id },
    });
  }
  console.log(`  ✓ ${tasks.length} sample tasks created`);

  console.log('✅ Seed complete');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
