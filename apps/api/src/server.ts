import { buildApp } from './app.js';
import { getEnv } from './lib/env.js';

const app = buildApp();
const env = getEnv();
const port = Number.parseInt(new URL(env.API_BASE_URL).port || '4000', 10);

app
  .listen({ port, host: '0.0.0.0' })
  .then(() => {
    console.log(`API listening on ${env.API_BASE_URL}`);
  })
  .catch((error) => {
    app.log.error(error);
    process.exit(1);
  });
