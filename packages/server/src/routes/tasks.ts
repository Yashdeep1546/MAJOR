import { Router } from 'express';
import { taskService } from '../services/task.service.js';
import { CreateTaskInput, UpdateTaskInput } from '@aether/shared';

const router = Router();

// ponytail: single hardcoded userId until auth lands
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

router.get('/', async (_req, res) => {
  const tasks = await taskService.list(DEFAULT_USER_ID, {
    status: _req.query.status as string | undefined,
    priority: _req.query.priority as string | undefined,
  });
  res.json(tasks);
});

router.get('/:id', async (req, res) => {
  const task = await taskService.getById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

router.post('/', async (req, res) => {
  const parsed = CreateTaskInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const task = await taskService.create(DEFAULT_USER_ID, parsed.data);
  res.status(201).json(task);
});

router.patch('/:id', async (req, res) => {
  const parsed = UpdateTaskInput.omit({ id: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const task = await taskService.update(req.params.id, parsed.data);
  res.json(task);
});

router.delete('/:id', async (req, res) => {
  await taskService.delete(req.params.id);
  res.status(204).end();
});

export default router;
