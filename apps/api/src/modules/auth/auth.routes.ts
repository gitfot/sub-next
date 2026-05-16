import type { FastifyInstance } from 'fastify';
import { loginSchema, registerSchema } from './auth.schema.js';
import { createUser, loginUser } from './auth.service.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const result = await createUser(input);
    return reply.status(201).send(result);
  });

  app.post('/login', async (request, reply) => {
    try {
      const input = loginSchema.parse(request.body);
      return await loginUser(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid credentials';
      if (message === 'Invalid credentials') {
        return reply.status(401).send({ message });
      }
      throw error;
    }
  });
}
