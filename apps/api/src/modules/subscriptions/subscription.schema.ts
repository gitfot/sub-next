import { z } from 'zod';
import { previewRequestSchema } from '../generator/generator.schema.js';

export const subscriptionTargets = ['v2rayn', 'clash', 'shadowrocket', 'surge'] as const;
export type SubscriptionTarget = (typeof subscriptionTargets)[number];

export const publishSubscriptionSchema = previewRequestSchema.extend({
  previewNodes: z.array(z.record(z.string(), z.unknown())).min(1),
  remark: z.string().trim().max(100).optional().transform((value) => value ?? ''),
  expiresAt: z.string().datetime(),
  subscriptionType: z.enum(subscriptionTargets),
});
