import { toolDefinitions, type ToolDefinition } from '@aether/shared';

export type ToolHandler = (args: Record<string, unknown>, userId: string) => Promise<unknown>;

const handlers = new Map<string, ToolHandler>();

/** Register a tool handler. */
export function registerTool(name: string, handler: ToolHandler) {
  handlers.set(name, handler);
}

/** Execute a tool by name, validating args against the shared Zod schema. */
export async function executeTool(
  name: string,
  rawArgs: Record<string, unknown>,
  userId: string,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const def = toolDefinitions.find((t) => t.name === name);
  if (!def) return { success: false, error: `Unknown tool: ${name}` };

  // Validate args with the Zod schema from @aether/shared
  const parsed = def.inputSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return { success: false, error: `Invalid args for ${name}: ${parsed.error.message}` };
  }

  const handler = handlers.get(name);
  if (!handler) return { success: false, error: `No handler registered for tool: ${name}` };

  try {
    const result = await handler(parsed.data, userId);
    return { success: true, result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/** Get all tool names. */
export function getRegisteredTools(): string[] {
  return Array.from(handlers.keys());
}
