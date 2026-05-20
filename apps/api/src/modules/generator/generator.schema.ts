import { z } from 'zod';

const datasetIdArraySchema = z.array(z.string().uuid()).optional();

export const previewRequestSchema = z.object({
  nodeLinkSetIds: datasetIdArraySchema,
  preferredAddressSetIds: datasetIdArraySchema,
  nodeLinkSetId: z.string().uuid().optional(),
  preferredAddressSetId: z.string().uuid().optional(),
  nodeLinksInput: z.string().min(1),
  preferredAddressesInput: z.string().min(1),
  namePrefix: z.string().max(50).optional(),
  keepOriginalHost: z.boolean().default(true),
});
