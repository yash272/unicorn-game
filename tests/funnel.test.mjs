import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleFunnel } from '../lib/funnel-api.ts';

function fixture() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../drizzle/0001_launch_funnel.sql', import.meta.url), 'utf8'));
  const db = { prepare(query) { const statement = { params: [], bind(...params) { this.params = params; return this; }, async run() { return { results: sql.prepare(query).all(...this.params), success: true }; } }; return statement; }, async batch(statements) { sql.exec('BEGIN'); try { const results = []; for (const s of statements) results.push(await s.run()); sql.exec('COMMIT'); return results; } catch (e) { sql.exec('ROLLBACK'); throw e; } } };
  const data = { email: 'founder@example.com', consent: true, sessionId: crypto.randomUUID(), location: 'hero', attribution: { utm_source: 'instagram', utm_medium: 'paid_social', utm_campaign: 'test-launch', utm_content: 'gameplay_video_1' } };
  const request = (body, origin = 'https://unicorn.test') => new Request('https://unicorn.test/api/launch', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) });
  return { sql, db, data, request, post: (body = data, kind = 'signup') => handleFunnel(request(body), db, kind) };
}
test('saves a real subscriber with consent and attribution, atomically records completion', async () => {
  const { sql, post } = fixture(); const response = await post();
  assert.equal(response.status, 200);
  const lead = sql.prepare('SELECT * FROM launch_subscribers').get();
  assert.equal(lead.email, 'founder@example.com'); assert.equal(lead.utm_source, 'instagram'); assert.equal(lead.utm_content, 'gameplay_video_1'); assert.equal(lead.cta_location, 'hero'); assert.equal(lead.status, 'subscribed'); assert.ok(lead.consent_version);
  assert.equal(sql.prepare("SELECT count(*) n FROM funnel_events WHERE name='email_signup_completed'").get().n, 1);
  assert.match(response.headers.get('cache-control'), /no-store/);
});
test('case-insensitive duplicate signup succeeds without duplicate lead or conversion', async () => {
  const { sql, post, data } = fixture(); await post(); const response = await post({ ...data, email: ' FOUNDER@EXAMPLE.COM ', location: 'bottom', sessionId: crypto.randomUUID() });
  assert.equal(response.status, 200); assert.equal(sql.prepare('SELECT count(*) n FROM launch_subscribers').get().n, 1); assert.equal(sql.prepare('SELECT count(*) n FROM funnel_events').get().n, 1);
});
test('validates email, consent, campaign size, session ID and honeypot', async () => {
  const { post, data, sql } = fixture();
  for (const patch of [{email:'invalid'}, {email:'a@b'}, {consent:false}, {sessionId:'injected'}, {attribution:{utm_campaign:'x'.repeat(151)}}, {website:'https://bot.example'}]) assert.equal((await post({...data,...patch})).status,400);
  assert.equal(sql.prepare('SELECT count(*) n FROM launch_subscribers').get().n,0);
});
test('rejects cross-origin posts and bodies over the byte limit', async () => {
  const { data, request, db } = fixture();
  assert.equal((await handleFunnel(request(data,'https://evil.example'),db,'signup')).status,403);
  assert.equal((await handleFunnel(request({...data,email:'x'.repeat(5000)}),db,'signup')).status,400);
});
test('analytics deduplicate within session/location and never accept forged completions', async () => {
  const { post, data, sql } = fixture(); const visit = { sessionId: data.sessionId, location: data.location, attribution: data.attribution };
  await post({...visit,name:'landing_page_view',location:'page'},'event'); await post({...visit,name:'landing_page_view',location:'page'},'event');
  assert.equal(sql.prepare('SELECT count(*) n FROM funnel_events').get().n,1);
  assert.equal((await post({...visit,name:'email_signup_completed'},'event')).status,400);
  const record = sql.prepare('SELECT * FROM funnel_events').get(); assert.equal('email' in record,false);
  assert.equal((await post({...visit,name:'kickstarter_click',location:'bottom'},'event')).status,200);
  assert.equal(sql.prepare('SELECT count(*) n FROM funnel_events').get().n,2);
});
test('limits signup bursts without storing raw IPs', async () => {
  const { post, sql } = fixture(); for(let i=0;i<12;i++) assert.equal((await post()).status,200);
  const blocked = await post(); assert.equal(blocked.status,429); assert.equal(blocked.headers.get('retry-after'),'60');
  assert.match(sql.prepare('SELECT key FROM funnel_rate_limits').get().key,/^[a-f0-9]{64}$/);
});
test('failed storage returns retryable failure, never a fake success', async () => {
  const { data, request } = fixture(); const db = { prepare(){throw new Error('private database details');} };
  const response = await handleFunnel(request(data),db,'signup'); assert.equal(response.status,503); assert.equal((await response.text()).includes('private database'),false);
});

test('an explicit new opt-in can reactivate a suppressed address without inflating acquisition', async () => {
  const { sql, post } = fixture(); await post(); sql.exec("UPDATE launch_subscribers SET status='unsubscribed'");
  assert.equal((await post()).status,200); assert.equal(sql.prepare('SELECT status FROM launch_subscribers').get().status,'subscribed'); assert.equal(sql.prepare('SELECT count(*) n FROM funnel_events').get().n,1);
});
