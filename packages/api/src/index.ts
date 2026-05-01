import { createApp } from './app';
import { db } from './db/client';
import { redis } from './lib/redis';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function start() {
  // Verify DB connectivity on startup
  await db.query('SELECT 1');
  console.log('✓ PostgreSQL connected');

  await redis.connect();
  console.log('✓ Redis connected');

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`✓ VibeSafe API listening on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
