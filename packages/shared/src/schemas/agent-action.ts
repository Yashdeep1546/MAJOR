import { z } from 'zod';
import { OrchestratorState } from './enums';

export const AgentActionSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  sessionId: z.string(),
  state: OrchestratorState,
  toolName: z.string().nullable(),
  toolInput: z.any().nullable(),
  toolOutput: z.any().nullable(),
  modelUsed: z.string().nullable(),
  latencyMs: z.number().int().nullable(),
  tokenCount: z.number().int().nullable(),
  error: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type AgentAction = z.infer<typeof AgentActionSchema>;

export const CreateAgentActionInput = z.object({
  conversationId: z.string().uuid(),
  sessionId: z.string(),
  state: OrchestratorState,
  toolName: z.string().optional(),
  toolInput: z.any().optional(),
  toolOutput: z.any().optional(),
  modelUsed: z.string().optional(),
  latencyMs: z.number().int().optional(),
  tokenCount: z.number().int().optional(),
  error: z.string().optional(),
});
export type CreateAgentActionInput = z.infer<typeof CreateAgentActionInput>;
