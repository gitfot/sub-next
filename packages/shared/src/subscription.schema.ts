import { z } from 'zod';
import { subscriptionTargets } from './enums.js';

export const previewRequestSchema = z.object({
  nodeLinkSetId: z.string().uuid().optional(),
  preferredAddressSetId: z.string().uuid().optional(),
  nodeLinksInput: z.string().min(1),
  preferredAddressesInput: z.string().min(1),
  namePrefix: z.string().max(50).optional(),
  keepOriginalHost: z.boolean().default(true),
});

export const publishSubscriptionSchema = previewRequestSchema.extend({
  previewNodes: z.array(z.record(z.string(), z.unknown())).min(1),
  remark: z.string().min(1).max(100),
  expiresAt: z.string().datetime(),
  subscriptionType: z.enum(subscriptionTargets),
});
