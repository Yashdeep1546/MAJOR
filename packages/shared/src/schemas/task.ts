import { z } from 'zod';
import { TaskStatus, Priority } from './enums';

export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable(),
  status: TaskStatus,
  priority: Priority,
  dueDate: z.coerce.date().nullable(),
  userId: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskInput = z.object({
  title: z.string().min(1).max(500).describe('The title of the task'),
  description: z.string().max(5000).optional().describe('A longer description of the task'),
  priority: Priority.optional().default('MEDIUM').describe('Task priority: LOW, MEDIUM, HIGH, or URGENT'),
  dueDate: z.string().optional().describe('Due date in ISO 8601 format, e.g. 2025-01-15'),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInput>;

export const UpdateTaskInput = z.object({
  id: z.string().min(1).describe('The ID of the task to update'),
  title: z.string().min(1).max(500).optional().describe('New title'),
  description: z.string().max(5000).optional().describe('New description'),
  status: TaskStatus.optional().describe('New status: TODO, IN_PROGRESS, DONE, or CANCELLED'),
  priority: Priority.optional().describe('New priority'),
  dueDate: z.string().nullable().optional().describe('New due date in ISO 8601 format, or null to clear'),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

export const ListTasksInput = z.object({
  status: TaskStatus.optional().describe('Filter by status'),
  priority: Priority.optional().describe('Filter by priority'),
});
export type ListTasksInput = z.infer<typeof ListTasksInput>;

export const CompleteTaskInput = z.object({
  id: z.string().min(1).describe('The ID of the task to mark as completed'),
});
export type CompleteTaskInput = z.infer<typeof CompleteTaskInput>;
