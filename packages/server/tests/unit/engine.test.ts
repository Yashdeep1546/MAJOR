import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { OrchestratorEngine } from '../../../src/orchestrator/engine.js';
import { GeminiClient } from '../../../src/orchestrator/gemini.js';
import * as registry from '../../../src/orchestrator/tools/registry.js';
import { auditService } from '../../../src/services/audit.service.js';

vi.mock('../../../src/orchestrator/gemini.js', () => {
  return { GeminiClient: vi.fn() };
});

describe('Orchestrator Engine State Transitions', () => {
  let engine: OrchestratorEngine;
  let mockGemini: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(auditService, 'log').mockResolvedValue();
    mockGemini = mockDeep<GeminiClient>();
    engine = new OrchestratorEngine(mockGemini);
  });

  it('should transition through UNDERSTAND -> PLAN -> SELECT_TOOL -> EXECUTE -> OBSERVE -> CRITIQUE', async () => {
    // UNDERSTAND, PLAN, OBSERVE, and CRITIQUE calls
    mockGemini.generateText.mockImplementation(async (prompt: string) => {
      if (prompt.includes('intent')) {
        return { text: '{"intent":"test"}', latencyMs: 10, tokenCount: 10 };
      }
      if (prompt.includes('Evaluate')) {
        return { text: '{"satisfied": false}', latencyMs: 10, tokenCount: 10 };
      }
      return { text: 'Final summary', latencyMs: 10, tokenCount: 10 };
    });

    // 1st Iteration: Call a tool
    mockGemini.planWithTools.mockResolvedValueOnce({
      toolName: 'create_task',
      toolArgs: { title: 'Test' },
      latencyMs: 10,
      tokenCount: 10,
    });

    // 2nd Iteration: Direct response (break loop)
    mockGemini.planWithTools.mockResolvedValueOnce({
      text: 'Done',
      latencyMs: 10,
      tokenCount: 10,
    });

    vi.spyOn(registry, 'executeTool').mockResolvedValueOnce({
      success: true,
      result: { id: 'task-1' }
    });

    const result = await engine.run({
      userMessage: 'create test task',
      conversationId: 'conv-1',
      userId: 'user-1'
    });

    // Assert state sequence
    expect(result.steps.map((s: any) => s.state)).toEqual([
      'UNDERSTAND', 'PLAN', 'SELECT_TOOL', 'EXECUTE', 'OBSERVE', 'PLAN', 'SELECT_TOOL', 'EXECUTE', 'CRITIQUE'
    ]);
    expect(result.response).toBe('Final summary');
    expect(result.toolsUsed).toEqual(['create_task']);
  });

  it('should handle RETRY path when tool args are malformed', async () => {
    mockGemini.generateText.mockImplementation(async () => {
      return { text: 'mock text', latencyMs: 10, tokenCount: 10 };
    });

    // 1. Plan with invalid args
    mockGemini.planWithTools.mockResolvedValueOnce({
      toolName: 'create_task',
      toolArgs: { wrong: true },
      latencyMs: 10,
      tokenCount: 10,
    });

    // 2. Plan text response to break loop
    mockGemini.planWithTools.mockResolvedValueOnce({
      text: 'Breaking loop after error',
      latencyMs: 10,
      tokenCount: 10,
    });

    vi.spyOn(registry, 'executeTool').mockResolvedValueOnce({
      success: false,
      error: 'Invalid args for tool create_task'
    });

    const result = await engine.run({
      userMessage: 'test retry',
      conversationId: 'conv-2',
      userId: 'user-2'
    });

    // Assert RETRY path is taken
    expect(result.steps.map((s: any) => s.state)).toEqual([
      'UNDERSTAND', 'PLAN', 'SELECT_TOOL', 'RETRY', 'PLAN', 'SELECT_TOOL', 'EXECUTE', 'CRITIQUE'
    ]);
  });
});
