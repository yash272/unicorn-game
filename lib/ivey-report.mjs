/** Dates are UTC and the end is exclusive. Validated integers are safe in CLI SQL. */
export function reportDate(value, fallback) {
  if (!value) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Use dates as YYYY-MM-DD.');
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Invalid calendar date.');
  return time;
}

export function iveyReportSql({ from = 0, until = Date.now() + 1, qa = false } = {}) {
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(until) || from < 0 || until <= from) throw new Error('Report end must be after its start.');
  const campaign = qa ? 'qa-ivey_launch' : 'ivey_launch';
  return `WITH variants(variant, poster) AS (
    VALUES ('build','A Build'),('cto','B CTO'),('billion','C Billion')
  ), visits AS (
    SELECT session_id, utm_content AS variant FROM funnel_events
    WHERE name='poster_qr_visit' AND utm_source='ivey_poster' AND utm_medium='offline'
      AND utm_campaign='${campaign}' AND created_at >= ${from} AND created_at < ${until}
    GROUP BY session_id, utm_content
  ), counts AS (
    SELECT v.poster, v.variant, COUNT(DISTINCT q.session_id) AS qr_visits,
      COUNT(DISTINCT CASE WHEN e.name='email_signup_started' THEN q.session_id END) AS signup_starts,
      COUNT(DISTINCT s.id) AS emails,
      COUNT(DISTINCT s.session_id) AS signup_visits,
      COUNT(DISTINCT CASE WHEN e.name='kickstarter_click' THEN q.session_id END) AS kickstarter_clicks
    FROM variants v LEFT JOIN visits q ON q.variant=v.variant
    LEFT JOIN funnel_events e ON e.session_id=q.session_id AND e.utm_content=v.variant
      AND e.utm_source='ivey_poster' AND e.utm_medium='offline' AND e.utm_campaign='${campaign}'
      AND e.created_at >= ${from} AND e.created_at < ${until}
      AND e.name IN ('email_signup_started','kickstarter_click')
    LEFT JOIN launch_subscribers s ON s.session_id=q.session_id AND s.utm_content=v.variant
      AND s.utm_source='ivey_poster' AND s.utm_medium='offline' AND s.utm_campaign='${campaign}'
      AND s.created_at >= ${from} AND s.created_at < ${until}
    GROUP BY v.poster,v.variant
  ) SELECT poster,variant,qr_visits,signup_starts,emails,signup_visits,
    ROUND(100.0*signup_visits/NULLIF(qr_visits,0),1) AS email_conversion_percent,
    kickstarter_clicks,
    ROUND(100.0*kickstarter_clicks/NULLIF(qr_visits,0),1) AS kickstarter_ctr_percent
  FROM counts ORDER BY poster`;
}

export const iveyColumns = ['poster', 'variant', 'qr_visits', 'signup_starts', 'emails', 'signup_visits', 'email_conversion_percent', 'kickstarter_clicks', 'kickstarter_ctr_percent'];

export function iveyReportHtml(rows, period) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
  const columns = [['poster','Variant'],['qr_visits','QR visits'],['signup_starts','Signup starts'],['emails','New emails'],['email_conversion_percent','Email conversion'],['kickstarter_clicks','KS clicks'],['kickstarter_ctr_percent','KS CTR']];
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UNICORN Ivey poster results</title><style>body{font:16px/1.6 system-ui;background:#f5f0e6;color:#202024;max-width:1100px;margin:40px auto;padding:0 22px}h1{line-height:1.1}table{width:100%;border-collapse:collapse;background:#fff}th,td{padding:13px;text-align:right;border-bottom:1px solid #ddd}th:first-child,td:first-child{text-align:left}th{background:#30233f;color:white}small{color:#625f62}.table{overflow:auto}</style><h1>UNICORN: Ivey poster results</h1><p>${escape(period)}</p><div class="table"><table><thead><tr>${columns.map(([,label])=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(([key])=>`<td>${row[key] == null ? '—' : escape(row[key])+(key.endsWith('_percent')?'%':'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>With equal print size, copies and display time, prefer the poster producing the most new emails. Use visits and conversion rates to explain why. Treat small differences and small samples as inconclusive.</p><p><small>QR visits are deduplicated 30-minute browser visits, not unique people or camera-open counts. Typed or shared poster links count too. Email conversion = visits producing at least one new address / QR visits. KS CTR = visits clicking Kickstarter / QR visits, not verified follows. This report includes only matching poster-arrival visits and conversions within the selected period. QA traffic is excluded unless explicitly selected.</small></p><p><small>Generated ${escape(new Date().toISOString())}. Re-run the report to refresh. No email addresses are included.</small></p></html>`;
}
