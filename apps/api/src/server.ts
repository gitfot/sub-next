import { buildApp } from './app.js';
import { ensureDatabaseSchema } from './lib/db-bootstrap.js';
import { getEnv } from './lib/env.js';

async function startServer() {
  await ensureDatabaseSchema();

  const app = buildApp();
  const env = getEnv();
  const port = Number.parseInt(new URL(env.API_BASE_URL).port || '4000', 10);

  await app.listen({ port, host: '0.0.0.0' });
  console.log(`API listening on ${env.API_BASE_URL}`);
}

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
