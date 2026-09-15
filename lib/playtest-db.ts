import { env } from 'cloudflare:workers';
export function playtestDatabase(): D1Database {
  const database = (env as unknown as { DB?: D1Database }).DB;
  if (!database) throw new Error('Playtest database is unavailable');
  return database;
}
