import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const action = process.argv[2], local = process.argv.includes('--local');
function query(sql) {
  const result = spawnSync(process.execPath, ['--import', './scripts/sites-env.mjs', './node_modules/wrangler/bin/wrangler.js', 'd1', 'execute', 'DB', local ? '--local' : '--remote', '--command', sql, '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (result.status !== 0) throw new Error('Cloudflare query failed. Check your Wrangler login and database binding. No export was created.');
  const parsed = JSON.parse(result.stdout);
  if (parsed.some(r => r.success === false)) throw new Error('Cloudflare did not complete the query.');
  return parsed.flatMap(r => r.results || []);
}
function csvCell(value) {
  let s = value == null ? '' : String(value);
  // Prevent spreadsheet formula evaluation in user-supplied fields.
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
const clean = "COALESCE(utm_campaign, '') NOT LIKE 'qa-%'";
try {
  if (action === 'export') {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const page = query(`SELECT email, datetime(created_at/1000, 'unixepoch') AS subscribed_at_utc, consent_version, cta_location, utm_source, utm_medium, utm_campaign, utm_content, utm_term FROM launch_subscribers WHERE status = 'subscribed' AND ${clean} ORDER BY created_at, id LIMIT 1000 OFFSET ${offset}`);
      rows.push(...page); if (page.length < 1000) break;
    }
    const columns = ['email', 'subscribed_at_utc', 'consent_version', 'cta_location', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    const folder = path.join(root, '.exports'); mkdirSync(folder, { recursive: true, mode: 0o700 });
    const file = path.join(folder, `unicorn-launch-list-${local ? 'local-' : ''}${new Date().toISOString().replaceAll(':', '-')}.csv`);
    writeFileSync(file, [columns.join(','), ...rows.map(row => columns.map(key => csvCell(row[key])).join(','))].join('\r\n') + '\r\n', { mode: 0o600, flag: 'wx' });
    console.log(`Exported ${rows.length} subscribed contacts to ${file}`);
    console.log('This private folder is excluded from Git. QA contacts and suppressed addresses are excluded.');
  } else if (action === 'report') {
    const summary = query(`SELECT COUNT(DISTINCT CASE WHEN name = 'landing_page_view' THEN session_id END) AS visits, COUNT(DISTINCT CASE WHEN name = 'email_signup_started' THEN session_id END) AS signup_starts, COUNT(DISTINCT CASE WHEN name = 'email_signup_completed' THEN session_id END) AS signup_visits, COUNT(DISTINCT CASE WHEN name = 'kickstarter_click' THEN session_id END) AS kickstarter_click_visits, COUNT(DISTINCT CASE WHEN name = 'gameplay_video_play' THEN session_id END) AS video_plays, COUNT(DISTINCT CASE WHEN name = 'scroll_50' THEN session_id END) AS scroll_50, COUNT(DISTINCT CASE WHEN name = 'scroll_90' THEN session_id END) AS scroll_90 FROM funnel_events WHERE ${clean}`)[0];
    const percent = n => summary.visits ? (100 * n / summary.visits).toFixed(1) + '%' : '0%';
    console.table([{ ...summary, email_conversion: percent(summary.signup_visits), kickstarter_click_rate: percent(summary.kickstarter_click_visits) }]);
    console.log('CTA locations (views and conversions are unique per visit/location):');
    console.table(query(`SELECT cta_location, COUNT(DISTINCT CASE WHEN name='cta_view' THEN session_id END) AS views, COUNT(DISTINCT CASE WHEN name='email_signup_started' THEN session_id END) AS starts, COUNT(DISTINCT CASE WHEN name='email_signup_completed' THEN session_id END) AS signups, COUNT(DISTINCT CASE WHEN name='kickstarter_click' THEN session_id END) AS kickstarter_clicks, ROUND(100.0 * COUNT(DISTINCT CASE WHEN name='email_signup_completed' THEN session_id END) / NULLIF(COUNT(DISTINCT CASE WHEN name='cta_view' THEN session_id END),0),1) AS signup_percent FROM funnel_events WHERE ${clean} AND cta_location != 'page' GROUP BY cta_location ORDER BY signups DESC, views DESC`));
    console.log('Ad attribution:');
    console.table(query(`SELECT COALESCE(utm_source,'direct') AS source, COALESCE(utm_medium,'') AS medium, COALESCE(utm_campaign,'') AS campaign, COALESCE(utm_content,'') AS creative, COUNT(DISTINCT CASE WHEN name='landing_page_view' THEN session_id END) AS visits, COUNT(DISTINCT CASE WHEN name='email_signup_completed' THEN session_id END) AS signups, COUNT(DISTINCT CASE WHEN name='kickstarter_click' THEN session_id END) AS kickstarter_clicks FROM funnel_events WHERE ${clean} GROUP BY utm_source,utm_medium,utm_campaign,utm_content ORDER BY visits DESC LIMIT 100`));
    console.log('Kickstarter clicks are outbound intent, not verified follows. QA campaigns are excluded.');
  } else if (action === 'suppress') {
    const email = process.argv.find(a => a.startsWith('--email='))?.slice(8).trim().toLowerCase();
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Use --email=person@example.com with a valid email.');
    query(`UPDATE launch_subscribers SET status='unsubscribed' WHERE email='${email.replaceAll("'", "''")}'`);
    console.log('Suppression saved. Matching addresses are excluded from future exports. Also suppress the contact in your sending platform.');
  } else throw new Error('Use export, report, or suppress [--email=person@example.com]. Add --local for development.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
