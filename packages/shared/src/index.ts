// @aether/shared — single source of truth for types across server, web, and LLM tool definitions

export { TaskStatus, Priority, OrchestratorState, PermissionTier, MessageRole } from './schemas/enums';

export {
  TaskSchema, type Task,
  CreateTaskInput, type CreateTaskInput as CreateTaskInputType,
  UpdateTaskInput, type UpdateTaskInput as UpdateTaskInputType,
  ListTasksInput, type ListTasksInput as ListTasksInputType,
  CompleteTaskInput, type CompleteTaskInput as CompleteTaskInputType,
} from './schemas/task';

export {
  AgentActionSchema, type AgentAction,
  CreateAgentActionInput, type CreateAgentActionInput as CreateAgentActionInputType,
} from './schemas/agent-action';

export {
  toolDefinitions, getGeminiFunctionDeclarations,
  type ToolDefinition,
} from './schemas/tool-definitions';
