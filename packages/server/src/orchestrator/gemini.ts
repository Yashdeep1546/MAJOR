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

  /** Text generation with the fast model (UNDERSTAND, CRITIQUE). */
  async generateText(prompt: string): Promise<{ text: string; tokenCount: number; latencyMs: number }> {
    const start = performance.now();
    const result = await this.fastModel.generateContent(prompt);
    const latencyMs = Math.round(performance.now() - start);
    const response = result.response;
    const text = response.text();
    const tokenCount = response.usageMetadata?.totalTokenCount ?? 0;
    return { text, tokenCount, latencyMs };
  }

  /** Function-calling with the reasoning model (PLAN). */
  async planWithTools(prompt: string): Promise<{
    toolName: string | null;
    toolArgs: Record<string, unknown> | null;
    text: string;
    tokenCount: number;
    latencyMs: number;
  }> {
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
  }
}
