import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { CreateTaskInput, UpdateTaskInput, ListTasksInput, CompleteTaskInput } from './task';

/** Strip JSON-Schema meta keys that Gemini doesn't understand. */
function toGeminiSchema(zodSchema: z.ZodType): Record<string, unknown> {
  const raw = zodToJsonSchema(zodSchema, { target: 'openApi3' }) as Record<string, unknown>;
  const { $schema, $ref, definitions, ...clean } = raw;

  function removeAdditionalProperties(obj: any) {
    if (Array.isArray(obj)) {
      for (const item of obj) removeAdditionalProperties(item);
    } else if (typeof obj === 'object' && obj !== null) {
      delete obj.additionalProperties;
      for (const key in obj) {
        removeAdditionalProperties(obj[key]);
      }
    }
  }
  removeAdditionalProperties(clean);

  return clean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** The Zod schema used for server-side validation of the LLM's arguments. */
  inputSchema: z.ZodType;
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'create_task',
    description:
      'Create a new task for the user. Use when the user wants to add a new task, todo item, or reminder.',
    parameters: toGeminiSchema(CreateTaskInput),
    inputSchema: CreateTaskInput,
  },
  {
    name: 'update_task',
    description:
      'Update an existing task. Use to change its title, description, status, priority, or due date.',
    parameters: toGeminiSchema(UpdateTaskInput),
    inputSchema: UpdateTaskInput,
  },
  {
    name: 'list_tasks',
    description:
      'List tasks for the current user. Optionally filter by status or priority.',
    parameters: toGeminiSchema(ListTasksInput),
    inputSchema: ListTasksInput,
  },
  {
    name: 'complete_task',
    description: 'Mark a task as completed.',
    parameters: toGeminiSchema(CompleteTaskInput),
    inputSchema: CompleteTaskInput,
  },
];

/** Gemini functionDeclarations format (without the inputSchema field). */
export function getGeminiFunctionDeclarations() {
  return toolDefinitions.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
}
