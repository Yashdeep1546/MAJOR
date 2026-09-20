import { z } from 'zod';

export const TaskStatus = z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const Priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type Priority = z.infer<typeof Priority>;

export const OrchestratorState = z.enum(['UNDERSTAND', 'PLAN', 'EXECUTE', 'CRITIQUE', 'RETRY']);
export type OrchestratorState = z.infer<typeof OrchestratorState>;

export const PermissionTier = z.enum(['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3']);
export type PermissionTier = z.infer<typeof PermissionTier>;

export const MessageRole = z.enum(['USER', 'ASSISTANT', 'SYSTEM']);
export type MessageRole = z.infer<typeof MessageRole>;
