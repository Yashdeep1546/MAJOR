import { describe, it, expect, vi, beforeEach } from 'vitest';
import { taskService, prisma } from '../../../src/services/task.service';

// Mock the internal prisma client methods
vi.mock('@prisma/client', () => {
  const mPrisma = {
    task: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { 
    PrismaClient: class {
      constructor() { return mPrisma; }
    } 
  };
});

describe('Task Service Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const userId = 'user-123';
  
  it('should create a task', async () => {
    const mockTask = { id: 'task-1', title: 'Test Task', userId };
    (prisma.task.create as any).mockResolvedValue(mockTask);

    const result = await taskService.create(userId, { title: 'Test Task' });
    
    expect(prisma.task.create).toHaveBeenCalledWith({
      data: {
        title: 'Test Task',
        description: null,
        priority: 'MEDIUM',
        dueDate: null,
        userId,
      }
    });
    expect(result).toEqual(mockTask);
  });

  it('should update a task', async () => {
    const mockTask = { id: 'task-1', title: 'Updated Task' };
    (prisma.task.update as any).mockResolvedValue(mockTask);

    const result = await taskService.update('task-1', { title: 'Updated Task', status: 'DONE' });
    
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: 'task-1' },
      data: { title: 'Updated Task', status: 'DONE' }
    });
    expect(result).toEqual(mockTask);
  });

  it('should throw error when updating non-existent task', async () => {
    (prisma.task.update as any).mockRejectedValue(new Error('Record to update not found'));

    await expect(taskService.update('invalid-id', { title: 'No' }))
      .rejects
      .toThrow('Record to update not found');
  });

  it('should list tasks with filters', async () => {
    const mockTasks = [{ id: 'task-1', title: 'Test', status: 'TODO', priority: 'HIGH' }];
    (prisma.task.findMany as any).mockResolvedValue(mockTasks);

    const result = await taskService.list(userId, { status: 'TODO', priority: 'HIGH' });
    
    expect(prisma.task.findMany).toHaveBeenCalledWith({
      where: { userId, status: 'TODO', priority: 'HIGH' },
      orderBy: { createdAt: 'desc' }
    });
    expect(result).toEqual(mockTasks);
  });

  it('should delete a task', async () => {
    (prisma.task.delete as any).mockResolvedValue({ id: 'task-1' });

    const result = await taskService.delete('task-1');
    expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    expect(result).toEqual({ id: 'task-1' });
  });
});
