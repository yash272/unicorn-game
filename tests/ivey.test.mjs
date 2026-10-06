import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {redirectIveyPoster,iveyVariants} from '../lib/ivey-campaign.mjs';
import {iveyReportSql,iveyReportHtml,reportDate} from '../lib/ivey-report.mjs';

test('clean poster routes redirect to the same homepage with fixed attribution, never query-supplied destinations',()=>{
  for(const variant of iveyVariants) {
    const response=redirectIveyPoster(new Request(`https://www.unicornthegame.com/ivey-${variant}?next=https://evil.test&utm_content=wrong`),variant);
    assert.equal(response.status,307);assert.equal(response.headers.get('cache-control'),'no-store');
    const url=new URL(response.headers.get('location'));
    assert.equal(url.origin,'https://www.unicornthegame.com');assert.equal(url.pathname,'/');
    assert.deepEqual(Object.fromEntries(url.searchParams),{utm_source:'ivey_poster',utm_medium:'offline',utm_campaign:'ivey_launch',utm_content:variant});
    const qa=redirectIveyPoster(new Request(`http://localhost:8816/ivey-${variant}?qa=1`),variant);
    assert.equal(new URL(qa.headers.get('location')).searchParams.get('utm_campaign'),'qa-ivey_launch');
    assert.equal(new URL(qa.headers.get('location')).origin,'http://localhost:8816');
  }
  assert.equal(redirectIveyPoster(new Request('https://unicorn.test/ivey-unknown'),'unknown').status,404);
});

function reportFixture(){
  const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0001_launch_funnel.sql',import.meta.url),'utf8'));
  const event=(session,name,variant,location='page',campaign='ivey_launch',time=100)=>sql.prepare('INSERT INTO funnel_events (id,name,session_id,cta_location,created_at,utm_source,utm_medium,utm_campaign,utm_content) VALUES (?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),name,session,location,time,'ivey_poster','offline',campaign,variant);
  const email=(session,variant,campaign='ivey_launch',time=110)=>sql.prepare('INSERT INTO launch_subscribers (id,email,created_at,consent_version,session_id,cta_location,utm_source,utm_medium,utm_campaign,utm_content) VALUES (?,?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),`${crypto.randomUUID()}@example.com`,time,'test',session,'hero','ivey_poster','offline',campaign,variant);
  return {sql,event,email};
}

test('poster report returns all variants with honest empty rates and no QA contamination',()=>{
  const {sql,event,email}=reportFixture();
  let rows=sql.prepare(iveyReportSql()).all();
  assert.equal(rows.length,3);for(const r of rows){assert.equal(r.qr_visits,0);assert.equal(r.email_conversion_percent,null);assert.equal(r.kickstarter_ctr_percent,null);}
  event('one','poster_qr_visit','build');event('two','poster_qr_visit','build');
  for(const where of ['hero','bottom']) {event('one','email_signup_started','build',where);event('one','kickstarter_click','build',where);}
  email('one','build');email('one','build'); // two addresses in one browser visit
  event('qa','poster_qr_visit','cto','page','qa-ivey_launch');email('qa','cto','qa-ivey_launch');
  email('missing-arrival','billion');
  rows=sql.prepare(iveyReportSql()).all();
  assert.deepEqual({...rows[0]},{poster:'A Build',variant:'build',qr_visits:2,signup_starts:1,emails:2,signup_visits:1,email_conversion_percent:50,kickstarter_clicks:1,kickstarter_ctr_percent:50});
  assert.equal(rows[1].emails,0);assert.equal(rows[2].emails,0);
  const qa=sql.prepare(iveyReportSql({qa:true})).all();assert.equal(qa[1].emails,1);assert.equal(qa[0].emails,0);
});

test('report date limits are exclusive and validate against malformed dates and SQL injection',()=>{
  assert.equal(reportDate('2026-10-06',0),Date.parse('2026-10-06T00:00:00Z'));
  for(const s of ['2026-02-30','2026-13-01','2026-10-06;DELETE FROM launch_subscribers','yesterday'])assert.throws(()=>reportDate(s,0));
  assert.throws(()=>iveyReportSql({from:100,until:100}));
  const {sql,event,email}=reportFixture();
  event('old','poster_qr_visit','build','page','ivey_launch',10);email('old','build','ivey_launch',15);
  event('in','poster_qr_visit','build','page','ivey_launch',100);email('in','build','ivey_launch',110);
  event('end','poster_qr_visit','build','page','ivey_launch',200);email('end','build','ivey_launch',201);
  const row=sql.prepare(iveyReportSql({from:100,until:200})).all()[0];assert.equal(row.qr_visits,1);assert.equal(row.emails,1);assert.equal(row.email_conversion_percent,100);
  assert.ok(iveyReportHtml([row],'<test>').includes('&lt;test&gt;'));
});

test('client preserves attribution, changes visit on another poster, and expires a long-open visit',async t=>{
  const store=new Map(), requests=[];let now=1000;
  const originals=Object.fromEntries(['window','document','sessionStorage','fetch'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  t.after(()=>{for(const [key,descriptor] of Object.entries(originals)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}});
  t.mock.method(Date,'now',()=>now);
  globalThis.window={location:{search:'?utm_source=ivey_poster&utm_medium=offline&utm_campaign=ivey_launch&utm_content=build'}};
  globalThis.document={referrer:''};globalThis.sessionStorage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
  globalThis.fetch=async(url,options)=>{requests.push({url,...JSON.parse(options.body)});return new Response('{}');};
  const client=await import('../lib/funnel-client.ts?ivey-test');
  const first=client.getVisit();client.track('landing_page_view');client.track('landing_page_view');
  assert.equal(requests.length,1);
  window.location.search='';assert.equal(client.getVisit().sessionId,first.sessionId);assert.equal(new URL(client.kickstarterUrl()).searchParams.get('utm_content'),'build');
  window.location.search='?utm_source=ivey_poster&utm_medium=offline&utm_campaign=ivey_launch&utm_content=cto';
  const next=client.getVisit();assert.notEqual(next.sessionId,first.sessionId);assert.equal(next.attribution.utm_content,'cto');
  client.track('email_signup_started','hero');assert.equal(requests.filter(r=>r.sessionId===next.sessionId).length,2);
  now+=31*60000;const expired=client.getVisit();assert.notEqual(expired.sessionId,next.sessionId);
  client.track('kickstarter_click','hero');assert.ok(requests.some(r=>r.sessionId===expired.sessionId&&r.name==='landing_page_view'));
  assert.equal(new URL(client.kickstarterUrl()).searchParams.get('utm_content'),'cto');
});
