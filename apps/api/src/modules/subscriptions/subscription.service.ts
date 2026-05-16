import crypto from 'node:crypto';
import { renderSubscription, type ParsedNode, type SubscriptionTarget } from '@cloudflaresub/sub-core';
import type { Prisma } from '@prisma/client';
import { db } from '../../lib/db.js';

interface PublishSubscriptionInput {
  nodeLinkSetId?: string | undefined;
  preferredAddressSetId?: string | undefined;
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix?: string | undefined;
  keepOriginalHost: boolean;
  previewNodes: ParsedNode[];
  remark: string;
  expiresAt: string;
  subscriptionType: SubscriptionTarget;
  publicBaseUrl: string;
}

export async function createSubscription(userId: string, input: PublishSubscriptionInput) {
  const rendered = renderSubscription(input.subscriptionType, input.previewNodes, input.publicBaseUrl);
  const publicToken = crypto.randomBytes(24).toString('hex');

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const subscription = await tx.subscription.create({
      data: {
        userId,
        remark: input.remark,
        subscriptionType: input.subscriptionType,
        publicToken,
        expiresAt: new Date(input.expiresAt),
      },
    });

    await tx.subscriptionSnapshot.create({
      data: {
        subscriptionId: subscription.id,
        userId,
        nodeLinkSetId: input.nodeLinkSetId ?? null,
        preferredAddressSetId: input.preferredAddressSetId ?? null,
        nodeLinksInput: input.nodeLinksInput,
        preferredAddressesInput: input.preferredAddressesInput,
        generatorOptions: {
          namePrefix: input.namePrefix,
          keepOriginalHost: input.keepOriginalHost,
        },
        previewNodesJson: input.previewNodes,
        renderedContent: rendered.body,
        renderedContentEncoding: input.subscriptionType === 'clash' || input.subscriptionType === 'surge' ? 'plain' : 'base64',
      },
    });

    return { subscription, publicToken, rendered };
  });
}

export function findPublicSubscription(publicToken: string) {
  return db.subscription.findUnique({ where: { publicToken } });
}

export async function findLatestSnapshot(subscriptionId: string) {
  const snapshot = await db.subscriptionSnapshot.findFirst({
    where: { subscriptionId },
    orderBy: { createdAt: 'desc' },
  });

  if (!snapshot) {
    throw new Error('Snapshot not found');
  }

  return snapshot;
}

export function listSubscriptions(userId: string) {
  return db.subscription.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getSubscriptionDetail(userId: string, id: string) {
  const subscription = await db.subscription.findUnique({ where: { id } });
  if (!subscription || subscription.userId !== userId || subscription.deletedAt) {
    return null;
  }
  const snapshot = await findLatestSnapshot(subscription.id);
  return { subscription, snapshot };
}

export async function restoreSubscriptionInput(userId: string, id: string) {
  const detail = await getSubscriptionDetail(userId, id);
  if (!detail) {
    return null;
  }

  const options = detail.snapshot.generatorOptions as { namePrefix?: string; keepOriginalHost?: boolean };
  return {
    nodeLinksInput: detail.snapshot.nodeLinksInput,
    preferredAddressesInput: detail.snapshot.preferredAddressesInput,
    namePrefix: options.namePrefix ?? '',
    keepOriginalHost: options.keepOriginalHost ?? true,
    previewNodes: detail.snapshot.previewNodesJson,
    ...(detail.snapshot.nodeLinkSetId ? { nodeLinkSetId: detail.snapshot.nodeLinkSetId } : {}),
    ...(detail.snapshot.preferredAddressSetId ? { preferredAddressSetId: detail.snapshot.preferredAddressSetId } : {}),
  };
}

export function softDeleteSubscription(userId: string, id: string) {
  return db.subscription.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}
