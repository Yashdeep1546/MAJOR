import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export const taskService = {
  async create(userId: string, data: { title: string; description?: string; priority?: string; dueDate?: string }) {
    return prisma.task.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        priority: (data.priority as any) ?? 'MEDIUM',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        userId,
      },
    });
  },

  async update(id: string, data: { title?: string; description?: string; status?: string; priority?: string; dueDate?: string | null }) {
    const update: Prisma.TaskUpdateInput = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description;
    if (data.status !== undefined) update.status = data.status as any;
    if (data.priority !== undefined) update.priority = data.priority as any;
    if (data.dueDate !== undefined) update.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    return prisma.task.update({ where: { id }, data: update });
  },

  async complete(id: string) {
    return prisma.task.update({ where: { id }, data: { status: 'DONE' } });
  },

  async list(userId: string, filters?: { status?: string; priority?: string }) {
    const where: Prisma.TaskWhereInput = { userId };
    if (filters?.status) where.status = filters.status as any;
    if (filters?.priority) where.priority = filters.priority as any;
    return prisma.task.findMany({ where, orderBy: { createdAt: 'desc' } });
  },

  async getById(id: string) {
    return prisma.task.findUnique({ where: { id } });
  },

  async delete(id: string) {
    return prisma.task.delete({ where: { id } });
  },
};

export { prisma };
