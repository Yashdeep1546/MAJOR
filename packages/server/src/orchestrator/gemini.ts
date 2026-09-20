import { GoogleGenerativeAI, type GenerativeModel, type FunctionDeclaration } from '@google/generative-ai';
import { config } from '../config.js';
import { getGeminiFunctionDeclarations } from '@aether/shared';

/** Wraps Google Generative AI with dual-model routing. */
export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private fastModel: GenerativeModel;
  private reasoningModel: GenerativeModel;

  constructor(apiKey?: string) {
    this.genAI = new GoogleGenerativeAI(apiKey ?? config.geminiApiKey);

    this.fastModel = this.genAI.getGenerativeModel({ model: config.models.fast });

    // Reasoning model gets tool definitions for function calling during PLAN
    this.reasoningModel = this.genAI.getGenerativeModel({
      model: config.models.reasoning,
      tools: [{
        functionDeclarations: getGeminiFunctionDeclarations() as FunctionDeclaration[],
      }],
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
        const isRateLimit = msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('Quota exceeded');
        const isUnavailable = msg.includes('503') || msg.includes('high demand') || msg.includes('Service Unavailable');

        if ((isRateLimit || isUnavailable) && attempt < maxRetries) {
          // Extract retryDelay if available in error message (e.g. "retryDelay":"48s")
          const delayMatch = msg.match(/retryDelay["']?:\s*["']?(\d+)s/i);
          const serverDelaySec = delayMatch ? parseInt(delayMatch[1], 10) : 0;
          const waitMs = serverDelaySec > 0 
            ? (serverDelaySec + 2) * 1000 
            : Math.pow(2, attempt + 1) * 10000; // 20s, 40s, 80s

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
