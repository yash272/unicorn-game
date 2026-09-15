import { playtestDatabase } from '../../../lib/playtest-db';
export async function POST(request: Request) {
  const response = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control':'no-store'}});
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return response({error:'Please submit this form from the UNICORN website.'},403);
  if (!request.headers.get('content-type')?.includes('application/json')) return response({error:'Please use the playtest form.'},415);
  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 4000) return response({error:'Your entry is too long. Please shorten it and try again.'},413);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid entry');
    input = parsed;
  } catch { return response({error:'Check your details and try again.'},400); }
  if (input.website) return response({success:true});
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const city = typeof input.city === 'string' ? input.city.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!name || name.length > 100 || !city || city.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || ![0,2,3,4].includes(input.players as number)) {
    return response({error:'Add your name, a valid email, your city, and your crew size.'},400);
  }
  try {
    await playtestDatabase().prepare('INSERT INTO playtest_signups (id, name, email, city, friends, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING').bind(crypto.randomUUID(),name,email,city,input.players,new Date().toISOString()).run();
    return response({success:true});
  } catch(error) {
    console.error('Playtest signup could not be saved',error instanceof Error ? error.message : 'Unknown database error');
    return response({error:'Your spot hasn’t been saved yet. Please try again in a moment.'},503);
  }
}
