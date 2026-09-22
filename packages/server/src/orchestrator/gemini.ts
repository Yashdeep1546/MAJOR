import { GoogleGenerativeAI, type GenerativeModel, type FunctionDeclaration } from '@google/generative-ai';
import { config } from '../config.js';
import { getGeminiFunctionDeclarations } from '@aether/shared';

export const AETHER_SYSTEM_INSTRUCTION = `You are AETHER, an intelligent personal task assistant.
Follow these operational guidelines strictly:
1. Tool Selection:
   - When completing or marking a task as done, ALWAYS use \`complete_task\` (never use \`update_task\`).
   - When creating a task, ALWAYS call \`create_task\` directly with the title. Never call \`list_tasks\` beforehand to check for duplicates; \`create_task\` handles duplicate prevention internally.
   - If the user provides an explicit task ID, pass it directly to \`complete_task\` or \`update_task\`. Do NOT call \`list_tasks\` first.
   - If the user refers to an existing task by name or description without an ID, call \`list_tasks\` first to discover the ID.
   - Requests to view, inspect, or query tasks (e.g., 'list all my tasks', 'what tasks are high priority?', 'what should I do today?', 'show my tasks', 'list things') must invoke \`list_tasks\`.
2. Implicit Task Creation:
   - If the user issues a brief imperative action phrase (e.g., 'Buy groceries', 'Call mom', 'Pay bills') without explicitly saying 'create a task', you MUST default to creating a task with that title using \`create_task\`. Do not ask clarifying questions about logistics, stores, or items unless the user's prompt is completely incomprehensible.
3. Ambiguous Requests / Missing Referents:
   - If a request is ambiguous, lacks a task title/details, or uses an unresolved pronoun with no prior context (e.g., 'Add a task', 'Update a task', 'Make it done', 'Create something', 'Change priority', 'Can you create it?', 'Is it completed?', 'I need help'), do NOT call any tools or list tasks. Respond conversationally asking the user for clarification.
4. Contradictory & Self-Correcting Instructions:
   - If the user issues contradictory instructions or self-corrects within a single prompt (e.g., 'Create a high priority task and then make it low priority', 'List tasks but actually just create a new one called Sleep', 'Create a task to buy groceries, no wait, to buy milk'), synthesize the final desired state and execute that intended action directly. If the request specifies task attributes (like priority) but omits a specific title (e.g., 'Create a high priority task and then make it low priority'), execute \`create_task\` using a sensible default title like 'New Task' and the synthesized priority.
5. Non-Task Requests:
   - If the user explicitly asks not to use tools or asks for simple greetings (e.g., 'Do not create any tasks, just say hello'), respond with text directly without calling tools.`;

/** Wraps Google Generative AI with dual-model routing. */
export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private fastModel: GenerativeModel;
  private reasoningModel: GenerativeModel;

  constructor(apiKey?: string) {
    this.genAI = new GoogleGenerativeAI(apiKey ?? config.geminiApiKey);

    this.fastModel = this.genAI.getGenerativeModel({
      model: config.models.fast,
      systemInstruction: AETHER_SYSTEM_INSTRUCTION,
    });

    // Reasoning model gets tool definitions for function calling during PLAN
    this.reasoningModel = this.genAI.getGenerativeModel({
      model: config.models.reasoning,
      tools: [{
        functionDeclarations: getGeminiFunctionDeclarations() as unknown as FunctionDeclaration[],
      }],
      systemInstruction: AETHER_SYSTEM_INSTRUCTION,
    });
  }

  private static lastCallTime = 0;
  private static readonly MIN_INTERVAL_MS = 12500; // 5 req/min = 1 request per 12 seconds

  private async safeCall<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Throttle to ensure at least MIN_INTERVAL_MS between API calls
      const now = Date.now();
      const timeSinceLast = now - GeminiClient.lastCallTime;
      if (timeSinceLast < GeminiClient.MIN_INTERVAL_MS) {
        await new Promise((r) => setTimeout(r, GeminiClient.MIN_INTERVAL_MS - timeSinceLast));
      }
      GeminiClient.lastCallTime = Date.now();

      try {
        return await fn();
      } catch (err: any) {
        const msg = String(err?.message || err);
        const isQuotaExceeded = msg.includes('Quota exceeded');
        const isRateLimit = msg.includes('429') || msg.includes('Too Many Requests');
        const isUnavailable = msg.includes('503') || msg.includes('high demand') || msg.includes('Service Unavailable');

        if (isQuotaExceeded) {
          console.warn('[GeminiClient] Hard API quota exceeded. Failing immediately.');
          throw err;
        }

        if ((isRateLimit || isUnavailable) && attempt < maxRetries) {
          // Extract retryDelay if available in error message (e.g. "retryDelay":"48s")
          const delayMatch = msg.match(/retryDelay["']?:\s*["']?(\d+)s/i);
          const serverDelaySec = delayMatch ? parseInt(delayMatch[1], 10) : 0;
          const waitMs = serverDelaySec > 0 
            ? (serverDelaySec + 2) * 1000 
            : Math.pow(2, attempt) * 2000; // 2s, 4s, 8s, 16s, 32s

          console.warn(`[GeminiClient] Hit rate limit/overload (${isRateLimit ? '429' : '503'}). Backing off for ${Math.round(waitMs / 1000)}s before retry ${attempt + 1}/${maxRetries}...`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw err;
      }
    }
    throw new Error('Max retries exceeded');
  }

  /** Text generation with the fast model (UNDERSTAND, CRITIQUE). */
  async generateText(prompt: string): Promise<{ text: string; tokenCount: number; latencyMs: number }> {
    return this.safeCall(async () => {
      const start = performance.now();
      const result = await this.fastModel.generateContent(prompt);
      const latencyMs = Math.round(performance.now() - start);
      const response = result.response;
      const text = response.text();
      const tokenCount = response.usageMetadata?.totalTokenCount ?? 0;
      return { text, tokenCount, latencyMs };
    });
  }

  /** Function-calling with the reasoning model (PLAN). */
  async planWithTools(prompt: string): Promise<{
    toolName: string | null;
    toolArgs: Record<string, unknown> | null;
    text: string;
    tokenCount: number;
    latencyMs: number;
  }> {
    return this.safeCall(async () => {
      const start = performance.now();
      const result = await this.reasoningModel.generateContent(prompt);
      const latencyMs = Math.round(performance.now() - start);
      const response = result.response;
      const tokenCount = response.usageMetadata?.totalTokenCount ?? 0;

      // Check if the model returned a function call
      const functionCalls = response.functionCalls();
      if (functionCalls && functionCalls.length > 0) {
        const fc = functionCalls[0];
        return {
          toolName: fc.name,
          toolArgs: (fc.args as Record<string, unknown>) ?? {},
          text: '',
          tokenCount,
          latencyMs,
        };
      }

      // Fallback: model replied with text instead of a function call
      return {
        toolName: null,
        toolArgs: null,
        text: response.text(),
        tokenCount,
        latencyMs,
      };
    });
  }
}
