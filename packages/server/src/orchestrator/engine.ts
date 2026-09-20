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

    // ── 1. UNDERSTAND (flash) ──────────────────────────────
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
    let finalPlan: any = null;
    let loopTimeout = false;

    let planPrompt = [
      'You are AETHER, an intelligent personal assistant.',
      'Based on this understanding of the user\'s request, decide which tool to use.',
      '',
      `Understanding: ${understand.text}`,
      `Original message: ${input.userMessage}`,
      '',
      'Call the most appropriate tool. If no tool is needed, respond with text.',
    ].join('\n');

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      // ── 2. PLAN (pro + function calling) ───────────────────
      const plan = await this.gemini.planWithTools(planPrompt);
      const planStep: StepResult = {
        state: 'PLAN',
        output: plan.toolName
          ? { toolName: plan.toolName, toolArgs: plan.toolArgs }
          : { text: plan.text },
        toolName: plan.toolName ?? undefined,
        toolInput: plan.toolArgs ?? undefined,
        modelUsed: config.models.reasoning,
        latencyMs: plan.latencyMs,
        tokenCount: plan.tokenCount,
      };
      steps.push(planStep);
      await this.logStep(input.conversationId, sessionId, planStep);
      finalPlan = plan;

      // ── 3. EXECUTE ─────────────────────────────────────────
      const execStart = performance.now();

      if (plan.toolName && plan.toolArgs) {
        const executeResult = await executeTool(plan.toolName, plan.toolArgs, input.userId);
        
        // Malformed JSON / Zod error fallback
        if (!executeResult.success && executeResult.error?.includes('Invalid args for')) {
          // ── RETRY ─────────────────────────────────────────
          const retryStep: StepResult = {
            state: 'RETRY',
            output: executeResult.error,
            modelUsed: 'none',
            latencyMs: Math.round(performance.now() - execStart),
            tokenCount: 0,
          };
          steps.push(retryStep);
          await this.logStep(input.conversationId, sessionId, retryStep);

          planPrompt += `\n\nPrevious attempt failed with error: ${executeResult.error}\nPlease correct the JSON tool arguments and try again.`;
          continue; // Loop back to PLAN
        }

        executeOutput = executeResult;
      } else {
        // No tool call — the model answered directly
        executeOutput = { directResponse: plan.text };
      }

      const execLatency = Math.round(performance.now() - execStart);
      const executeStep: StepResult = {
        state: 'EXECUTE',
        output: executeOutput,
        toolName: plan.toolName ?? undefined,
        toolInput: plan.toolArgs ?? undefined,
        toolOutput: executeOutput,
        modelUsed: 'none',
        latencyMs: execLatency,
        tokenCount: 0,
      };
      steps.push(executeStep);
      await this.logStep(input.conversationId, sessionId, executeStep);

      // Successful execution or direct response, break the loop
      break;
    }

    if (iterations >= MAX_ITERATIONS && !executeOutput) {
      loopTimeout = true;
      executeOutput = { error: 'LOOP_TIMEOUT' };
    }

    // ── 4. CRITIQUE (flash) ────────────────────────────────
    let critiquePrompt = '';
    if (loopTimeout) {
      critiquePrompt = 'The system reached the maximum number of iterations trying to fulfill the request. Generate a polite error message to the user explaining that the request failed due to complexity or internal errors.';
    } else {
      critiquePrompt = [
        'You are AETHER, an intelligent personal assistant.',
        'The user asked: ' + input.userMessage,
        '',
        finalPlan?.toolName
          ? `You used the tool "${finalPlan.toolName}" with args: ${JSON.stringify(finalPlan.toolArgs)}`
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
      };
    }

    return {
      response: critique.text,
      sessionId,
      steps,
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
