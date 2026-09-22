import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { executeTool } from '../../src/orchestrator/tools/registry.js';
import { registerTaskTools } from '../../src/orchestrator/tools/task-tools.js';
import { redisService } from '../../src/services/redis.service.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

describe('Failure Recovery & Resilience Integration Tests', () => {
  beforeAll(async () => {
    registerTaskTools();
    await prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: { id: TEST_USER_ID, name: 'Failure Test User' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('1. Invalid Task ID Handling', () => {
    it('should return a graceful error result when completing a non-existent task ID', async () => {
      const result = await executeTool('complete_task', { id: '999999999999' }, TEST_USER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('should return a graceful error result when updating a non-existent task ID', async () => {
      const result = await executeTool(
        'update_task',
        { id: '00000000-0000-0000-0000-000000000000', priority: 'HIGH' },
        TEST_USER_ID
      );
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return 404 from REST API when fetching a non-existent task', async () => {
      const res = await request(app)
        .get('/api/tasks/00000000-0000-0000-0000-000000000000')
        .expect(404);
      expect(res.body).toEqual({ error: 'Task not found' });
    });
  });

  describe('2. Malformed Tool Input Validation', () => {
    it('should catch missing required title in create_task schema and return validation error', async () => {
      const result = await executeTool(
        'create_task',
        { description: 'Missing title', priority: 'LOW' },
        TEST_USER_ID
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid args for create_task');
    });

    it('should catch missing id in update_task schema and return validation error', async () => {
      const result = await executeTool(
        'update_task',
        { title: 'New Title without ID' },
        TEST_USER_ID
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid args for update_task');
    });

    it('should safely reject unknown tool names without throwing exceptions', async () => {
      const result = await executeTool('non_existent_tool', {}, TEST_USER_ID);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown tool: non_existent_tool');
    });

    it('should reject malformed payload in REST POST /api/tasks with 400', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ description: 'No title provided' })
        .expect(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('3. Redis Fallback Resilience', () => {
    it('should safely return null on Redis cache miss without throwing', async () => {
      const history = await redisService.getConversationHistory('00000000-0000-0000-0000-000000000000');
      expect(history).toBeNull();
    });

    it('should allow GET /api/chat/recent to gracefully query PostgreSQL when no Redis key exists', async () => {
      const res = await request(app)
        .get('/api/chat/recent')
        .expect(200);
      expect(res.body).toHaveProperty('messages');
      expect(Array.isArray(res.body.messages)).toBe(true);
    });

    it('should write and read from Redis when connection is healthy', async () => {
      const testConvId = 'test-conv-' + Date.now();
      const testHistory = [{ role: 'user', content: 'hello' }];

      await redisService.setConversationHistory(testConvId, testHistory, 60);
      const retrieved = await redisService.getConversationHistory(testConvId);

      expect(retrieved).toEqual(testHistory);
    });
  });
});
