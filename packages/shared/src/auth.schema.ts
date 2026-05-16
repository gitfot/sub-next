import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  account: z.string().min(3),
  password: z.string().min(8).max(128),
});
