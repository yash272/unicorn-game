import { z } from 'zod';

const locations = ['page', 'hero', 'how-to-play', 'betrayal', 'playtest', 'bottom', 'sticky', 'nav'] as const;
const clientEvents = ['landing_page_view', 'email_signup_started', 'kickstarter_click', 'gameplay_video_play', 'scroll_50', 'scroll_90', 'cta_view'] as const;
const attribution = z.object({
  utm_source: z.string().max(150).optional(), utm_medium: z.string().max(150).optional(),
  utm_campaign: z.string().max(150).optional(), utm_content: z.string().max(150).optional(),
  utm_term: z.string().max(150).optional(), referrer_host: z.string().max(253).optional(),
}).strict().default({});
const base = z.object({ sessionId: z.string().uuid(), location: z.enum(locations), attribution });
const signup = base.extend({ email: z.string().trim().toLowerCase().email().max(254), website: z.string().max(200).optional(), consent: z.literal(true) });
const event = base.extend({ name: z.enum(clientEvents) });
const consentVersion = 'launch-and-major-updates-v1';

function json(body: object, status = 200, extra = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}
async function readBody(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new Error('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw new Error('origin');
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('body');
  // Bound the stream itself: Content-Length is not guaranteed or trustworthy.
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 4096) { await reader.cancel(); throw new Error('body'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function allowed(db: D1DatabaseSession, request: Request, kind: string) {
  const now = Date.now(), window = Math.floor(now / 60000);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${window}:${ip}:${kind}`));
  const key = Array.from(new Uint8Array(hash), x => x.toString(16).padStart(2, '0')).join('');
  const results = await db.batch([
    db.prepare('DELETE FROM funnel_rate_limits WHERE expires_at < ?').bind(now),
    db.prepare('INSERT INTO funnel_rate_limits (key, hits, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET hits = hits + 1 RETURNING hits').bind(key, now + 120000),
  ]);
  return Number((results[1].results[0] as { hits: number }).hits) <= (kind === 'signup' ? 12 : 120);
}
function values(a: z.infer<typeof attribution>) {
  return [a.utm_source || null, a.utm_medium || null, a.utm_campaign || null, a.utm_content || null, a.utm_term || null, a.referrer_host || null];
}

// Injecting the binding keeps storage behavior testable against real SQLite.
export async function handleFunnel(request: Request, db: D1DatabaseSession, kind: 'signup' | 'event') {
  let body: unknown;
  try { body = await readBody(request); }
  catch (error) { return json({ error: error instanceof Error && error.message === 'origin' ? 'Please submit from the UNICORN website.' : 'Please check your details and try again.' }, error instanceof Error && error.message === 'origin' ? 403 : 400); }
  const parsed = (kind === 'signup' ? signup : event).safeParse(body);
  if (!parsed.success) return json({ error: kind === 'signup' ? 'Enter a valid email address to join the launch list.' : 'Invalid event.' }, 400);
  if ('website' in parsed.data && parsed.data.website) return json({ error: 'Please reload the page and try again.' }, 400);
  try {
    if (!await allowed(db, request, kind)) return json({ error: 'Too many attempts. Please wait a minute and try again.' }, 429, { 'Retry-After': '60' });
    const d = parsed.data, now = Date.now();
    if (kind === 'signup' && 'email' in d) {
      const id = crypto.randomUUID();
      await db.batch([
        db.prepare(`INSERT INTO launch_subscribers (id, email, created_at, consent_version, session_id, cta_location, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer_host) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET status = 'subscribed', consent_version = excluded.consent_version`)
          .bind(id, d.email, now, consentVersion, d.sessionId, d.location, ...values(d.attribution)),
        // Only a genuinely new subscriber creates a completion, in the same transaction.
        db.prepare(`INSERT OR IGNORE INTO funnel_events (id, name, session_id, cta_location, created_at, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer_host) SELECT ?, 'email_signup_completed', ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM launch_subscribers WHERE id = ?)`)
          .bind(crypto.randomUUID(), d.sessionId, d.location, now, ...values(d.attribution), id),
      ]);
      // Identical response for duplicates; never expose list membership.
      return json({ ok: true });
    }
    if ('name' in d) {
      await db.prepare(`INSERT OR IGNORE INTO funnel_events (id, name, session_id, cta_location, created_at, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer_host) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), d.name, d.sessionId, d.location, now, ...values(d.attribution)).run();
    }
    return json({ ok: true });
  } catch {
    // Do not log request bodies, email addresses, IPs or database details.
    return json({ error: 'The launch list is temporarily unavailable. Please try again in a moment. You can still follow us on Kickstarter below.' }, 503);
  }
}
