import { PrismaClient } from '@prisma/client';
import { OrchestratorEngine } from '../src/orchestrator/engine.js';
import { registerTaskTools } from '../src/orchestrator/tools/task-tools.js';
import { auditService } from '../src/services/audit.service.js';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

const prisma = new PrismaClient();

const EVAL_PROMPTS = [
  // Standard requests
  { prompt: 'Buy groceries', expectedTool: 'create_task' },
  { prompt: 'Create a task to finish the report', expectedTool: 'create_task' },
  { prompt: 'Update my first task to HIGH priority', expectedTool: 'update_task' },
  { prompt: 'Complete the groceries task', expectedTool: 'complete_task' },
  { prompt: 'List all my tasks', expectedTool: 'list_tasks' },
  { prompt: 'What tasks are high priority?', expectedTool: 'list_tasks' },
  { prompt: 'Add a new task: call mom tomorrow', expectedTool: 'create_task' },
  { prompt: 'Mark the report task as done', expectedTool: 'complete_task' },
  { prompt: 'Can you show me my TODO tasks?', expectedTool: 'list_tasks' },
  { prompt: 'Change priority of call mom to URGENT', expectedTool: 'update_task' },

  // Ambiguous requests
  { prompt: 'Add a task', expectedTool: null }, // LLM should probably ask for details instead of invoking tool without title, or it might just create a task called 'unknown' (depends on schema). Let's expect null (conversational)
  { prompt: 'Update a task', expectedTool: null },
  { prompt: 'Make it done', expectedTool: null },
  { prompt: 'Create something', expectedTool: null },
  { prompt: 'Change priority', expectedTool: null },
  { prompt: 'List things', expectedTool: 'list_tasks' }, // might map to list_tasks
  { prompt: 'What should I do today?', expectedTool: 'list_tasks' },
  { prompt: 'I need help', expectedTool: null },
  { prompt: 'Can you create it?', expectedTool: null },
  { prompt: 'Is it completed?', expectedTool: null },

  // Contradictory / Edge cases
  { prompt: 'Create a task to buy groceries, no wait, to buy milk', expectedTool: 'create_task' },
  { prompt: 'Create a high priority task and then make it low priority', expectedTool: 'create_task' }, // LLM will probably just create it as low priority
  { prompt: 'List tasks but actually just create a new one called Sleep', expectedTool: 'create_task' },
  { prompt: 'Do not create any tasks, just say hello', expectedTool: null },
  { prompt: 'Complete task ID 999999999999', expectedTool: 'complete_task' }, // LLM will try to call the tool, the tool will fail, LLM will handle error.

  // Duplicate requests (Idempotency testing)
  { prompt: 'Create a task called "Duplicate Test"', expectedTool: 'create_task' },
  { prompt: 'Create a task called "Duplicate Test"', expectedTool: 'create_task' }, // Should return 'Task already exists'
  { prompt: 'Create a task called "duplicate test"', expectedTool: 'create_task' }, // Should return 'Task already exists'
  { prompt: 'Add another task called "Duplicate Test"', expectedTool: 'create_task' }, // Should return 'Task already exists'
  { prompt: 'Make a task named "Duplicate Test"', expectedTool: 'create_task' }, // Should return 'Task already exists'
];

async function runEval() {
  console.log('🧪 AETHER Phase 1 Eval Suite (30 Prompts)\n');

  registerTaskTools();

  // Set up test user
  const user = await prisma.user.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'Test User' },
  });

  const engine = new OrchestratorEngine();

  const results: any[] = [];
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < EVAL_PROMPTS.length; i++) {
    const test = EVAL_PROMPTS[i];
    console.log(`[${i + 1}/${EVAL_PROMPTS.length}] Running: "${test.prompt}"`);

    // Create fresh conversation for each to avoid history interference
    const conv = await prisma.conversation.create({
      data: { userId: user.id },
    });

    const startTime = performance.now();
    let actualTool: string | null = null;
    let success = false;
    
    try {
      const result = await engine.run({
        userMessage: test.prompt,
        conversationId: conv.id,
        userId: user.id,
      });

      const dbActions = await auditService.getBySessionId(result.sessionId);
      const planAction = dbActions.find((a) => a.state === 'PLAN' || (a.state === 'EXECUTE' && a.toolName));
      
      // Look at the final execute state or the plan state to see what tool was chosen
      actualTool = planAction?.toolName ?? null;

      // Special handling for duplicates or ambiguous
      // If expectedTool is null, we pass if actualTool is null or if the LLM reasonably chose a tool (e.g. list_tasks).
      // We will strictly check expected vs actual, but for 'null' it's tricky. Let's just do an exact match or close enough for this test.
      // We will count it as passed if expectedTool === actualTool
      if (test.expectedTool === actualTool) {
        success = true;
      } else if (test.expectedTool === null && actualTool === 'create_task') {
        // sometimes it hallucinates a task. Let's just mark it.
        success = false;
      } else if (test.expectedTool === 'create_task' && actualTool === null) {
        success = false;
      } else {
        success = false;
      }

      if (success) passed++;
      else failed++;

    } catch (e: any) {
      console.error(`  Error: ${e.message}`);
      failed++;
    }

    const latency = Math.round(performance.now() - startTime);
    results.push({
      prompt: test.prompt,
      expected: test.expectedTool || 'None',
      actual: actualTool || 'None',
      latency,
      pass: success
    });

    console.log(`  Expected: ${test.expectedTool || 'None'}, Actual: ${actualTool || 'None'} -> ${success ? '✅' : '❌'}`);
    
    // Sleep for 9 seconds to avoid Gemini Free Tier rate limit (15 RPM)
    await new Promise((resolve) => setTimeout(resolve, 9000));
  }

  // Generate Report
  const reportLines = [
    '# Phase 1 Evaluation Report',
    '',
    `**Total Prompts**: ${EVAL_PROMPTS.length}`,
    `**Passed**: ${passed}`,
    `**Failed**: ${failed}`,
    '',
    '| Prompt | Expected Tools | Actual Tools | Latency (ms) | Pass/Fail |',
    '|---|---|---|---|---|'
  ];

  for (const r of results) {
    reportLines.push(`| ${r.prompt} | ${r.expected} | ${r.actual} | ${r.latency} | ${r.pass ? '✅' : '❌'} |`);
  }

  const reportPath = path.resolve(process.cwd(), 'Phase1_Eval_Report.md');
  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf-8');
  console.log(`\n📄 Report saved to ${reportPath}`);
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
}

runEval()
  .catch((e) => {
    console.error('💥 Eval failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
