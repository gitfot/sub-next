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

export function softDeletePreferredAddressSet(userId: string, id: string) {
  return db.preferredAddressSet.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}
