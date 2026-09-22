import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { OrchestratorEngine } from '../orchestrator/engine.js';
import { redisService } from '../services/redis.service.js';

const router = Router();
const prisma = new PrismaClient();
const engine = new OrchestratorEngine();

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

router.get('/recent', async (req, res, next) => {
  try {
    // Find the most recent conversation for the default user
    const conversation = await prisma.conversation.findFirst({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { createdAt: 'desc' },
    });

    if (!conversation) {
      return res.json({ conversationId: null, messages: [] });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });
    
    const actions = await prisma.agentAction.findMany({
      where: { conversationId: conversation.id, state: 'CRITIQUE' },
      select: { sessionId: true, createdAt: true },
    });

    const formattedMessages = messages.map((m) => {
      const action = m.role === 'ASSISTANT' 
        ? actions.find(a => Math.abs(a.createdAt.getTime() - m.createdAt.getTime()) < 5000)
        : null;

      return {
        id: m.id,
        role: m.role.toLowerCase(),
        content: m.content,
        timestamp: m.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sessionId: action?.sessionId,
      };
    });

    res.json({
      conversationId: conversation.id,
      messages: formattedMessages,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { message, conversationId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const conv = await prisma.conversation.create({
        data: { userId: DEFAULT_USER_ID },
      });
      convId = conv.id;
    }

    // Store user message
    await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'USER',
        content: message,
      },
    });

    // Fetch recent history for context from Redis first, then Postgres
    let history: Array<{role: string; content: string}> = [];
    const cachedHistory = await redisService.getConversationHistory(convId);
    
    if (cachedHistory) {
      console.log(`[Redis] Cache HIT for conversation ${convId}`);
      history = cachedHistory;
    } else {
      console.log(`[Redis] Cache MISS for conversation ${convId}, falling back to Postgres`);
      const recentMessages = await prisma.message.findMany({
        where: { conversationId: convId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      history = recentMessages.reverse().map((m) => ({
        role: m.role.toLowerCase(),
        content: m.content,
      }));
    }

    // Run orchestrator
    const result = await engine.run({
      userMessage: message,
      conversationId: convId,
      userId: DEFAULT_USER_ID,
      history,
    });

    // Store assistant response
    await prisma.message.create({
      data: {
        conversationId: convId,
        role: 'ASSISTANT',
        content: result.response,
      },
    });

    // Update Redis cache with the new interaction
    const updatedHistory = [
      ...history, 
      { role: 'user', content: message }, 
      { role: 'assistant', content: result.response }
    ];
    // Keep context window bounded to 20 messages
    await redisService.setConversationHistory(convId, updatedHistory.slice(-20), 3600);

    res.json({
      response: result.response,
      conversationId: convId,
      sessionId: result.sessionId,
      steps: result.steps,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/', async (req, res, next) => {
  try {
    await prisma.agentAction.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.conversation.deleteMany({});
    res.json({ success: true, message: 'All chat history and audit traces cleared' });
  } catch (err) {
    next(err);
  }
});

export default router;
