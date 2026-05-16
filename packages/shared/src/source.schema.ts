import { z } from 'zod';

export const datasetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  content: z.string().min(1),
});
