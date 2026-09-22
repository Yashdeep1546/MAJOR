import { PrismaClient } from '@prisma/client';
import { OrchestratorEngine } from '../src/orchestrator/engine.js';
import { registerTaskTools } from '../src/orchestrator/tools/task-tools.js';
import 'dotenv/config';

const prisma = new PrismaClient();

async function verifyDatabaseTrace() {
  console.log('🔍 Starting End-to-End Database Trace Verification...\n');

  registerTaskTools();

  const user = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'Trace Test User' },
  });

  // Seed a known task to allow multi-step ID lookup
  await prisma.task.deleteMany({ where: { userId: user.id } });
  const seedTask = await prisma.task.create({
    data: {
      userId: user.id,
      title: 'Review Project Architecture',
      status: 'TODO',
      priority: 'MEDIUM',
    },
  });
  console.log(`📌 Seeded test task: "${seedTask.title}" (ID: ${seedTask.id}, Priority: ${seedTask.priority})`);

  const conv = await prisma.conversation.create({
    data: { userId: user.id },
  });

  const engine = new OrchestratorEngine();
  const testPrompt = 'Update my first task to HIGH priority';

  console.log(`🤖 Sending prompt: "${testPrompt}"...`);
  const result = await engine.run({
    userMessage: testPrompt,
    conversationId: conv.id,
    userId: user.id,
  });

  console.log(`\n✅ Orchestrator completed. Session ID: ${result.sessionId}`);
  console.log(`💬 Response: "${result.response.substring(0, 100)}..."`);
  console.log(`🔧 Tools used: ${result.toolsUsed?.join(' -> ')}`);

  // Query PostgreSQL directly for the raw recorded agent_actions
  console.log('\n📊 Querying PostgreSQL agent_actions table directly...');
  const recordedActions = await prisma.agentAction.findMany({
    where: { sessionId: result.sessionId },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`\nFound ${recordedActions.length} recorded state transitions in PostgreSQL:\n`);
  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log(' # | State        | Model           | Latency | Tool Name   | Output Summary');
  console.log('───┼──────────────┼─────────────────┼─────────┼─────────────┼────────────────');

  for (let i = 0; i < recordedActions.length; i++) {
    const a = recordedActions[i];
    const outputPreview = JSON.stringify(a.toolOutput || {}).substring(0, 30);
    console.log(
      ` ${(i + 1).toString().padStart(2)} | ` +
      `${(a.state || '').padEnd(12)} | ` +
      `${(a.modelUsed || 'none').padEnd(15)} | ` +
      `${((a.latencyMs || 0) + 'ms').padStart(7)} | ` +
      `${(a.toolName || 'none').padEnd(11)} | ` +
      `${outputPreview}...`
    );
  }
  console.log('─────────────────────────────────────────────────────────────────────────────\n');

  // Verify updated task in DB
  const updatedTask = await prisma.task.findUnique({ where: { id: seedTask.id } });
  console.log(`📋 PostgreSQL Task State Verification:`);
  console.log(`   Task Title: "${updatedTask?.title}"`);
  console.log(`   Task Priority: ${updatedTask?.priority} (Expected: HIGH) -> ${updatedTask?.priority === 'HIGH' ? '✅ MATCH' : '❌ MISMATCH'}`);

  await prisma.$disconnect();
}

verifyDatabaseTrace().catch((e) => {
  console.error('Trace verification failed:', e);
  process.exit(1);
});
