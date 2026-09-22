import { v4 as uuid } from 'uuid';
import { GeminiClient } from './gemini.js';
import { executeTool } from './tools/registry.js';
import { auditService } from '../services/audit.service.js';
import { STATE_SEQUENCE, STATE_MODEL_MAP, type StepResult } from './states.js';
import { config } from '../config.js';

export interface OrchestratorInput {
  userMessage: string;
  conversationId: string;
  userId: string;
  /** Previous messages for context. */
  history?: Array<{ role: string; content: string }>;
}

export interface OrchestratorOutput {
  response: string;
  sessionId: string;
  steps: StepResult[];
  toolsUsed?: string[];
}

export class OrchestratorEngine {
  private gemini: GeminiClient;

  constructor(geminiClient?: GeminiClient) {
    this.gemini = geminiClient ?? new GeminiClient();
  }

  async run(input: OrchestratorInput): Promise<OrchestratorOutput> {
    const sessionId = uuid();
    const steps: StepResult[] = [];
    const historyBlock = (input.history ?? [])
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    // ── 1. UNDERSTAND (fast) ──────────────────────────────
    const understandPrompt = [
      'You are AETHER, an intelligent personal assistant.',
      'Analyze the following user message and extract:',
      '1. The user\'s intent (what they want to accomplish)',
      '2. Key entities (task names, dates, priorities, etc.)',
      '3. Any ambiguities that need clarification',
      '',
      historyBlock ? `Previous conversation:\n${historyBlock}\n` : '',
      `User message: ${input.userMessage}`,
      '',
      'Respond with a concise JSON object: { "intent": "...", "entities": {...}, "ambiguities": [] }',
    ].join('\n');

    const understand = await this.gemini.generateText(understandPrompt);
    const understandStep: StepResult = {
      state: 'UNDERSTAND',
      output: understand.text,
      modelUsed: config.models.fast,
      latencyMs: understand.latencyMs,
      tokenCount: understand.tokenCount,
    };
    steps.push(understandStep);
    await this.logStep(input.conversationId, sessionId, understandStep);

    // Loop variables
    const MAX_ITERATIONS = 5;
    let iterations = 0;
    let executeOutput: unknown;
    let loopTimeout = false;
    const toolsUsed: string[] = [];
    let actionContext = ''; // accumulates prior tool results for multi-step reasoning

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      // ── 2. PLAN (fast) — produce strategy text ──────────
      const planPrompt = [
        'You are AETHER, an intelligent personal assistant.',
        'Based on this understanding of the user\'s request, describe your strategy.',
        'Core Rules:',
        '- Creating tasks: Always plan to call `create_task` directly with the title. Do NOT plan to check `list_tasks` first (duplicate checking is handled internally by create_task).',
        '- Implicit task creation: If the user issues a brief imperative action phrase (e.g., "Buy groceries", "Call mom", "Pay bills") without saying "create a task", default to creating a task using `create_task`.',
        '- Completing tasks: When marking a task as done or completed, always plan to use `complete_task` (never `update_task`).',
        '- Explicit ID provided: If the user provides an explicit task ID (e.g., "Complete task ID 999999999999"), plan to call `complete_task` or `update_task` directly with that ID. Do NOT call `list_tasks` first.',
        '- Named task without ID: If the user refers to an existing task by name or position (e.g., "Complete the groceries task", "Update my first task to HIGH priority", "Mark the report task as done") but you do not know its ID, plan to call `list_tasks` first to find the ID, and then perform the action in the next step.',
        '- Viewing tasks: Queries asking to view, list, or check tasks (e.g., "List all my tasks", "What tasks are high priority?", "Can you show me my TODO tasks?", "List things", "What should I do today?") are valid queries that must call `list_tasks`.',
        '- Ambiguous or missing target: If the request is ambiguous, lacks a target task name/details, or contains unresolved pronouns with no prior context (e.g., "Add a task", "Update a task", "Make it done", "Create something", "Change priority", "Can you create it?", "Is it completed?", "I need help"), do NOT call any tools or list tasks. Plan to respond directly asking the user for the missing details.',
        '- Contradictory / self-correcting: Synthesize the final desired state and execute the intended action (e.g. "Create a high priority task and then make it low priority" -> call `create_task` with title: "New Task" and priority: LOW).',
        '- Explicit non-task requests: If the user asks you not to create tasks or just say hello (e.g. "Do not create any tasks, just say hello"), respond with text directly without calling tools.',
        '',
        `Understanding: ${understand.text}`,
        `Original message: ${input.userMessage}`,
        actionContext ? `\nPrevious actions and results:\n${actionContext}` : '',
        '',
        'Describe your strategy concisely. Do not call any tools yet.',
      ].join('\n');

      const plan = await this.gemini.generateText(planPrompt);
      const planStep: StepResult = {
        state: 'PLAN',
        output: plan.text,
        modelUsed: config.models.fast,
        latencyMs: plan.latencyMs,
        tokenCount: plan.tokenCount,
      };
      steps.push(planStep);
      await this.logStep(input.conversationId, sessionId, planStep);

      // ── 3. SELECT_TOOL (reasoning + function calling) ───
      const selectPrompt = [
        'You are AETHER, an intelligent personal assistant.',
        'Based on this strategy, select and call the most appropriate tool.',
        'If no tool is needed, respond with text directly.',
        '',
        `Strategy: ${plan.text}`,
        `Understanding: ${understand.text}`,
        `Original message: ${input.userMessage}`,
        actionContext ? `\nPrevious actions and results:\n${actionContext}` : '',
        '',
        'Call the most appropriate tool now, or respond with text if no tool is needed.',
      ].join('\n');

      const selection = await this.gemini.planWithTools(selectPrompt);
      const selectStep: StepResult = {
        state: 'SELECT_TOOL',
        output: selection.toolName
          ? { toolName: selection.toolName, toolArgs: selection.toolArgs }
          : { text: selection.text },
        toolName: selection.toolName ?? undefined,
        toolInput: selection.toolArgs ?? undefined,
        modelUsed: config.models.reasoning,
        latencyMs: selection.latencyMs,
        tokenCount: selection.tokenCount,
      };
      steps.push(selectStep);
      await this.logStep(input.conversationId, sessionId, selectStep);

      // ── 4. EXECUTE ─────────────────────────────────────
      const execStart = performance.now();

      if (selection.toolName && selection.toolArgs) {
        toolsUsed.push(selection.toolName);
        const executeResult = await executeTool(selection.toolName, selection.toolArgs, input.userId);

        // Malformed JSON / Zod error fallback → RETRY
        if (!executeResult.success && executeResult.error?.includes('Invalid args for')) {
          const retryStep: StepResult = {
            state: 'RETRY',
            output: executeResult.error,
            modelUsed: 'none',
            latencyMs: Math.round(performance.now() - execStart),
            tokenCount: 0,
          };
          steps.push(retryStep);
          await this.logStep(input.conversationId, sessionId, retryStep);

          actionContext += `\nTool "${selection.toolName}" failed with: ${executeResult.error}\nPlease correct the arguments and try again.`;
          continue; // Loop back to PLAN
        }

        executeOutput = executeResult;

        const execLatency = Math.round(performance.now() - execStart);
        const executeStep: StepResult = {
          state: 'EXECUTE',
          output: executeOutput,
          toolName: selection.toolName,
          toolInput: selection.toolArgs,
          toolOutput: executeOutput,
          modelUsed: 'none',
          latencyMs: execLatency,
          tokenCount: 0,
        };
        steps.push(executeStep);
        await this.logStep(input.conversationId, sessionId, executeStep);

        // ── 5. OBSERVE (fast) — inspect result, decide next step ──
        const observePrompt = [
          'You are AETHER. Evaluate whether the user\'s intent has been fully satisfied.',
          '',
          `User asked: ${input.userMessage}`,
          `Strategy: ${plan.text}`,
          `Tool "${selection.toolName}" returned: ${JSON.stringify(executeOutput)}`,
          `Actions completed so far: ${toolsUsed.join(' → ')}`,
          '',
          'Respond with JSON only: { "satisfied": true, "reasoning": "..." } or { "satisfied": false, "reasoning": "...", "nextAction": "..." }',
          'Set satisfied=true if the user\'s full request is complete or if the tool executed and returned a definitive result (including "Task already exists", not found, or error).',
          'Set satisfied=false if more tool calls are needed to fulfill the original request (e.g., after finding a task ID with list_tasks, we still need to update or complete it).',
        ].join('\n');

        const observation = await this.gemini.generateText(observePrompt);
        const observeStep: StepResult = {
          state: 'OBSERVE',
          output: observation.text,
          modelUsed: config.models.fast,
          latencyMs: observation.latencyMs,
          tokenCount: observation.tokenCount,
        };
        steps.push(observeStep);
        await this.logStep(input.conversationId, sessionId, observeStep);

        // Parse the OBSERVE decision
        let satisfied = true;
        try {
          const jsonMatch = observation.text.match(/\{[\s\S]*?\}/);
          if (jsonMatch) {
            const decision = JSON.parse(jsonMatch[0]);
            satisfied = decision.satisfied === true;
          }
        } catch {
          // ponytail: if parsing fails, assume satisfied to avoid infinite loops
          satisfied = true;
        }

        if (satisfied) {
          break; // Proceed to CRITIQUE
        }

        // Not satisfied — feed context back and loop to PLAN
        actionContext += `\nTool "${selection.toolName}" returned: ${JSON.stringify(executeOutput)}\nObservation: ${observation.text}`;
        continue;
      } else {
        // No tool call — the model answered directly
        executeOutput = { directResponse: selection.text };

        const execLatency = Math.round(performance.now() - execStart);
        const executeStep: StepResult = {
          state: 'EXECUTE',
          output: executeOutput,
          toolName: undefined,
          toolInput: undefined,
          toolOutput: executeOutput,
          modelUsed: 'none',
          latencyMs: execLatency,
          tokenCount: 0,
        };
        steps.push(executeStep);
        await this.logStep(input.conversationId, sessionId, executeStep);

        // Direct response = intent handled, break to CRITIQUE
        break;
      }
    }

    if (iterations >= MAX_ITERATIONS && !executeOutput) {
      loopTimeout = true;
      executeOutput = { error: 'LOOP_TIMEOUT' };
    }

    // ── 6. CRITIQUE (fast) ────────────────────────────────
    let critiquePrompt = '';
    if (loopTimeout) {
      critiquePrompt = 'The system reached the maximum number of iterations trying to fulfill the request. Generate a polite error message to the user explaining that the request failed due to complexity or internal errors.';
    } else {
      critiquePrompt = [
        'You are AETHER, an intelligent personal assistant.',
        'The user asked: ' + input.userMessage,
        '',
        toolsUsed.length > 0
          ? `You used the tool(s): ${toolsUsed.join(' → ')}`
          : 'You responded directly without using a tool.',
        '',
        `Result: ${JSON.stringify(executeOutput)}`,
        '',
        'Generate a natural, helpful response to the user summarizing what was done.',
        'Be conversational and concise. If there was an error, explain it clearly.',
      ].join('\n');
    }

    const critique = await this.gemini.generateText(critiquePrompt);
    const critiqueStep: StepResult = {
      state: 'CRITIQUE',
      output: loopTimeout ? 'LOOP_TIMEOUT' : critique.text,
      modelUsed: config.models.fast,
      latencyMs: critique.latencyMs,
      tokenCount: critique.tokenCount,
    };
    steps.push(critiqueStep);
    await this.logStep(input.conversationId, sessionId, critiqueStep);

    if (loopTimeout) {
      return {
        response: 'I encountered an error while trying to process that request (Loop Timeout). Please try rephrasing.',
        sessionId,
        steps,
        toolsUsed,
      };
    }

    return {
      response: critique.text,
      sessionId,
      steps,
      toolsUsed,
    };
  }

  private async logStep(conversationId: string, sessionId: string, step: StepResult) {
    await auditService.log({
      conversationId,
      sessionId,
      state: step.state,
      toolName: step.toolName,
      toolInput: step.toolInput,
      toolOutput: step.toolOutput,
      modelUsed: step.modelUsed,
      latencyMs: step.latencyMs,
      tokenCount: step.tokenCount,
    });
  }
}
