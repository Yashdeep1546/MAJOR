import { PrismaClient } from '@prisma/client';
import type { CreateAgentActionInputType } from '@aether/shared';

const prisma = new PrismaClient();

export const auditService = {
  async log(data: CreateAgentActionInputType) {
    return prisma.agentAction.create({ data: data as any });
  },

  async getBySessionId(sessionId: string) {
    return prisma.agentAction.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  },

  async getByConversationId(conversationId: string) {
    return prisma.agentAction.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  },
};
