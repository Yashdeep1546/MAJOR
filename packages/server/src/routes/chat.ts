import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { OrchestratorEngine } from '../orchestrator/engine.js';

const router = Router();
const prisma = new PrismaClient();
const engine = new OrchestratorEngine();

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

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

    // Fetch recent history for context
    const recentMessages = await prisma.message.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const history = recentMessages.reverse().map((m) => ({
      role: m.role.toLowerCase(),
      content: m.content,
    }));

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

export default router;
