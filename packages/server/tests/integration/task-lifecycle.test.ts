import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Task Lifecycle API Integration', () => {
  let createdTaskId: string;

  // Clean up any dangling test tasks just in case
  beforeAll(async () => {
    await prisma.task.deleteMany({
      where: { title: 'Integration Test Task' }
    });
  });

  afterAll(async () => {
    if (createdTaskId) {
      await prisma.task.deleteMany({
        where: { id: createdTaskId }
      });
    }
    await prisma.$disconnect();
  });

  it('should create a task via API and persist it in DB', async () => {
    // 1. Create via API
    const response = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Integration Test Task',
        description: 'Testing the lifecycle',
        priority: 'HIGH'
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    createdTaskId = response.body.id;
    expect(response.body.title).toBe('Integration Test Task');

    // 2. Verify in DB directly
    const dbTask = await prisma.task.findUnique({
      where: { id: createdTaskId }
    });
    expect(dbTask).not.toBeNull();
    expect(dbTask?.title).toBe('Integration Test Task');
    expect(dbTask?.priority).toBe('HIGH');
    expect(dbTask?.status).toBe('TODO');
  });

  it('should update the task via API and verify in DB', async () => {
    // 1. Update via API
    const response = await request(app)
      .patch(`/api/tasks/${createdTaskId}`)
      .send({
        status: 'DONE',
        priority: 'URGENT'
      })
      .expect(200);

    expect(response.body.status).toBe('DONE');

    // 2. Verify in DB directly
    const dbTask = await prisma.task.findUnique({
      where: { id: createdTaskId }
    });
    expect(dbTask?.status).toBe('DONE');
    expect(dbTask?.priority).toBe('URGENT');
  });

  it('should delete the task via API and verify it is removed from DB', async () => {
    // 1. Delete via API
    await request(app)
      .delete(`/api/tasks/${createdTaskId}`)
      .expect(204);

    // 2. Verify in DB directly
    const dbTask = await prisma.task.findUnique({
      where: { id: createdTaskId }
    });
    expect(dbTask).toBeNull();
  });
});
