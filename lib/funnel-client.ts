export type Location = 'page' | 'hero' | 'how-to-play' | 'betrayal' | 'playtest' | 'bottom' | 'sticky' | 'nav';
type Event = 'landing_page_view' | 'email_signup_started' | 'kickstarter_click' | 'gameplay_video_play' | 'scroll_50' | 'scroll_90' | 'cta_view';
type Visit = { sessionId: string; attribution: Record<string, string>; expires: number };
const utms = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
export const kickstarter = 'https://www.kickstarter.com/projects/yash272/unicorn-the-startup-card-game';
let visit: Visit | undefined;
const sent = new Set<string>();

export function getVisit() {
  const params = new URLSearchParams(window.location.search);
  const attribution: Record<string, string> = {};
  for (const key of utms) { const value = params.get(key); if (value) attribution[key] = value.slice(0, 150); }
  const matches = (candidate: Visit) => candidate.expires > Date.now()
    && (!Object.keys(attribution).length || utms.every(key => candidate.attribution[key] === attribution[key]));
  if (visit && matches(visit)) return visit;
  try {
    const saved = JSON.parse(sessionStorage.getItem('unicorn-visit-v1') || 'null') as Visit | null;
    if (saved && typeof saved.sessionId === 'string' && saved.attribution && matches(saved)) return (visit = saved);
  } catch { /* In-app browsers may disable storage; memory still works. */ }
  try { if (document.referrer) attribution.referrer_host = new URL(document.referrer).hostname; } catch {}
  visit = { sessionId: crypto.randomUUID(), attribution, expires: Date.now() + 30 * 60 * 1000 };
  sent.clear();
  try { sessionStorage.setItem('unicorn-visit-v1', JSON.stringify(visit)); } catch {}
  return visit;
}

export function track(name: Event, location: Location = 'page') {
  const { sessionId, attribution } = getVisit();
  // An interaction after the 30-minute visit expires starts a fresh measured visit.
  if (name !== 'landing_page_view' && !sent.has(`${sessionId}:landing_page_view:page`)) track('landing_page_view');
  const key = `${sessionId}:${name}:${location}`;
  if (sent.has(key)) return;
  sent.add(key);
  // keepalive lets outbound clicks finish recording without delaying navigation.
  void fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, location, sessionId, attribution }), keepalive: true })
    .then(response => { if (!response.ok) sent.delete(key); }).catch(() => { sent.delete(key); });
}
export function kickstarterUrl() {
  const url = new URL(kickstarter);
  for (const [key, value] of Object.entries(getVisit().attribution)) if (utms.includes(key)) url.searchParams.set(key, value);
  return url.href;
}
export function focusSignup(location: Location) {
  const forms = [...document.querySelectorAll<HTMLElement>('[data-launch-signup]')].filter(form => form.querySelector('input[type=email]'));
  const target = forms.sort((a, b) => Math.abs(a.getBoundingClientRect().top - 140) - Math.abs(b.getBoundingClientRect().top - 140))[0];
  if (!target) return;
  target.dataset.entryLocation = location;
  target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
  target.querySelector<HTMLInputElement>('input[type=email]')?.focus({ preventScroll: true });
}
