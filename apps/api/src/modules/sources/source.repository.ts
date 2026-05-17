import { db } from '../../lib/db.js';

export function listNodeLinkSets(userId: string) {
  return db.nodeLinkSet.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
  });
}

export function createNodeLinkSet(userId: string, input: { name: string; description?: string | undefined; content: string }) {
  return db.nodeLinkSet.create({
    data: { userId, name: input.name, content: input.content, ...(input.description ? { description: input.description } : {}) },
  });
}

export async function updateNodeLinkSet(
  userId: string,
  id: string,
  input: { name: string; description?: string | undefined; content: string },
) {
  const result = await db.nodeLinkSet.updateMany({
    where: { id, userId, deletedAt: null },
    data: {
      name: input.name,
      description: input.description ?? null,
      content: input.content,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return db.nodeLinkSet.findUnique({ where: { id } });
}

export function softDeleteNodeLinkSet(userId: string, id: string) {
  return db.nodeLinkSet.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

export function listPreferredAddressSets(userId: string) {
  return db.preferredAddressSet.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
  });
}

export function createPreferredAddressSet(userId: string, input: { name: string; description?: string | undefined; content: string }) {
  return db.preferredAddressSet.create({
    data: { userId, name: input.name, content: input.content, ...(input.description ? { description: input.description } : {}) },
  });
}

export async function updatePreferredAddressSet(
  userId: string,
  id: string,
  input: { name: string; description?: string | undefined; content: string },
) {
  const result = await db.preferredAddressSet.updateMany({
    where: { id, userId, deletedAt: null },
    data: {
      name: input.name,
      description: input.description ?? null,
      content: input.content,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return db.preferredAddressSet.findUnique({ where: { id } });
}

export function softDeletePreferredAddressSet(userId: string, id: string) {
  return db.preferredAddressSet.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}
