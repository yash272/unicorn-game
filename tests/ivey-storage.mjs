// Verify actual D1 rows for a completed ivey.browser.mjs run. Read-only.
// node tests/ivey-storage.mjs work/ivey-qa-.../results.json [--remote]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const samples = JSON.parse(readFileSync(process.argv[2], 'utf8'));
assert.equal(samples.length, 6, 'A/B/C on both mobile sizes must have completed');
for (const sample of samples) assert.match(sample.sessionId, /^[a-f0-9-]{36}$/);
const ids = samples.map(sample => `'${sample.sessionId}'`).join(',');
const sql = `SELECT session_id, name, utm_source, utm_medium, utm_campaign, utm_content, COUNT(*) AS count
 FROM funnel_events WHERE session_id IN (${ids}) GROUP BY session_id,name,utm_source,utm_medium,utm_campaign,utm_content;
 SELECT session_id, utm_source, utm_medium, utm_campaign, utm_content, COUNT(*) AS count
 FROM launch_subscribers WHERE session_id IN (${ids}) GROUP BY session_id,utm_source,utm_medium,utm_campaign,utm_content;`;
const result = spawnSync(process.execPath, ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', process.argv.includes('--remote') ? '--remote' : '--local', '--command', sql, '--json'], { encoding: 'utf8' });
assert.equal(result.status, 0, 'D1 read-only query must succeed');
const [events, subscribers] = JSON.parse(result.stdout).map(query => query.results);
for (const sample of samples) {
  const rows = events.filter(row => row.session_id === sample.sessionId);
  const leads = subscribers.filter(row => row.session_id === sample.sessionId);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].count, 1, 'duplicate UI signup must save one address');
  for (const name of ['landing_page_view', 'poster_qr_visit', 'email_signup_completed', 'kickstarter_click']) {
    assert.equal(rows.find(row => row.name === name)?.count, 1, `${sample.variant}: ${name}`);
  }
  assert.ok(rows.some(row => row.name === 'email_signup_started'));
  for (const row of [...rows, ...leads]) {
    assert.equal(row.utm_source, 'ivey_poster');
    assert.equal(row.utm_medium, 'offline');
    assert.equal(row.utm_campaign, sample.campaign);
    assert.equal(row.utm_content, sample.variant);
  }
  console.log(`PASS ${sample.device} / ${sample.variant}: one new subscriber, one poster visit, one completion and one Kickstarter click; attribution intact.`);
}
