import type { OrchestratorState } from '@aether/shared';

/** Maps each state to the model tier it uses. */
export const STATE_MODEL_MAP: Record<OrchestratorState, 'fast' | 'reasoning'> = {
  UNDERSTAND: 'fast',
  PLAN: 'fast',
  SELECT_TOOL: 'reasoning', // function-calling step
  EXECUTE: 'fast', // no LLM call, placeholder
  OBSERVE: 'fast', // inspects tool output, decides next step
  CRITIQUE: 'fast',
  RETRY: 'fast', // no LLM call, placeholder for transition
};

/** Deterministic transition order. */
export const STATE_SEQUENCE: OrchestratorState[] = [
  'UNDERSTAND',
  'PLAN',
  'SELECT_TOOL',
  'EXECUTE',
  'OBSERVE',
  'CRITIQUE',
];

export interface StepResult {
  state: OrchestratorState;
  output: unknown;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  modelUsed: string;
  latencyMs: number;
  tokenCount: number;
}
