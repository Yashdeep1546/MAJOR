import { registerTool } from './registry.js';
import { taskService } from '../../services/task.service.js';

export function registerTaskTools() {
  registerTool('create_task', async (args, userId) => {
    const payload = args as { title: string; description?: string; priority?: string; dueDate?: string };
    
    // Idempotency check: does a similar task exist?
    // Using simple exact match for this phase (as approved).
    const existing = await taskService.list(userId, { status: 'TODO' });
    const inProgress = await taskService.list(userId, { status: 'IN_PROGRESS' });
    const activeTasks = [...existing, ...inProgress];
    
    if (activeTasks.some(t => t.title.toLowerCase() === payload.title.toLowerCase())) {
      return { result: "Task already exists" };
    }

    const task = await taskService.create(userId, payload);
    return { id: task.id, title: task.title, status: task.status, priority: task.priority, dueDate: task.dueDate };
  });

  registerTool('update_task', async (args: any) => {
    const { id, ...data } = args;
    const task = await taskService.update(id, data);
    return { id: task.id, title: task.title, status: task.status, priority: task.priority, dueDate: task.dueDate };
  });

  registerTool('list_tasks', async (args, userId) => {
    const tasks = await taskService.list(userId, args as any);
    return tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate }));
  });

  registerTool('complete_task', async (args: any) => {
    const task = await taskService.complete(args.id);
    return { id: task.id, title: task.title, status: task.status };
  });
}
