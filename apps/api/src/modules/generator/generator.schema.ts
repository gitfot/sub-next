import { z } from 'zod';

export const previewRequestSchema = z.object({
  nodeLinkSetId: z.string().uuid().optional(),
  preferredAddressSetId: z.string().uuid().optional(),
  nodeLinksInput: z.string().min(1),
  preferredAddressesInput: z.string().min(1),
  namePrefix: z.string().max(50).optional(),
  keepOriginalHost: z.boolean().default(true),
});
