import crypto from 'node:crypto';
import { renderSubscription, type ParsedNode } from 'sub-core';
import type { Prisma } from '@prisma/client';
import { db } from '../../lib/db.js';
import type { SubscriptionTarget } from './subscription.schema.js';

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

function toPrismaJson(value: Prisma.InputJsonValue | ParsedNode[]) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getSubscriptionStatus(subscription: { expiresAt: Date; deletedAt: Date | null }) {
  if (subscription.deletedAt) {
    return 'deleted';
  }
  if (subscription.expiresAt < new Date()) {
    return 'expired';
  }
  return 'active';
}

function buildPublicUrl(publicBaseUrl: string, publicToken: string) {
  return `${publicBaseUrl}/subscriptions/public/${publicToken}`;
}

function mapSubscriptionListItem(
  publicBaseUrl: string,
  subscription: Awaited<ReturnType<typeof db.subscription.create>>,
) {
  return {
    id: subscription.id,
    remark: subscription.remark,
    subscriptionType: subscription.subscriptionType,
    createdAt: subscription.createdAt.toISOString(),
    expiresAt: subscription.expiresAt.toISOString(),
    status: getSubscriptionStatus(subscription),
    publicUrl: buildPublicUrl(publicBaseUrl, subscription.publicToken),
  };
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
        generatorOptions: toPrismaJson({
          namePrefix: input.namePrefix,
          keepOriginalHost: input.keepOriginalHost,
        }),
        previewNodesJson: toPrismaJson(input.previewNodes),
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

export async function listSubscriptions(userId: string, publicBaseUrl: string) {
  const items = await db.subscription.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
  });
  return items.map((item) => mapSubscriptionListItem(publicBaseUrl, item));
}

export async function getSubscriptionDetail(userId: string, id: string, publicBaseUrl: string) {
  const subscription = await db.subscription.findUnique({ where: { id } });
  if (!subscription || subscription.userId !== userId || subscription.deletedAt) {
    return null;
  }
  const snapshot = await findLatestSnapshot(subscription.id);
  const options = snapshot.generatorOptions as { namePrefix?: string; keepOriginalHost?: boolean };
  return {
    subscription: mapSubscriptionListItem(publicBaseUrl, subscription),
    snapshot: {
      nodeLinksInput: snapshot.nodeLinksInput,
      preferredAddressesInput: snapshot.preferredAddressesInput,
      namePrefix: options.namePrefix ?? '',
      keepOriginalHost: options.keepOriginalHost ?? true,
      previewNodes: snapshot.previewNodesJson,
      ...(snapshot.nodeLinkSetId ? { nodeLinkSetId: snapshot.nodeLinkSetId } : {}),
      ...(snapshot.preferredAddressSetId ? { preferredAddressSetId: snapshot.preferredAddressSetId } : {}),
    },
  };
}

export async function restoreSubscriptionInput(userId: string, id: string) {
  const detail = await getSubscriptionDetail(userId, id, 'http://restore-base-unused');
  if (!detail) {
    return null;
  }

  return {
    nodeLinksInput: detail.snapshot.nodeLinksInput,
    preferredAddressesInput: detail.snapshot.preferredAddressesInput,
    namePrefix: detail.snapshot.namePrefix,
    keepOriginalHost: detail.snapshot.keepOriginalHost,
    requiresRegenerate: true,
    restoredFromSubscriptionId: id,
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
