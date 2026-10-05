'use client';
/* Static, pre-optimized WebP assets; no runtime image service required. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowUpRight, ArrowRight, Check, Sparkles } from 'lucide-react';
import { focusSignup, getVisit, kickstarter, kickstarterUrl, track, type Location } from '../lib/funnel-client';

export function KickstarterLink({ location, children, className = 'kickstarter-link' }: { location: Location; children?: ReactNode; className?: string }) {
  return <a href={kickstarter} target="_blank" rel="noopener noreferrer" className={className} onClick={event => { event.currentTarget.href = kickstarterUrl(); track('kickstarter_click', location); }}>{children || <>Follow on Kickstarter <ArrowUpRight size={17}/></>}</a>;
}

export function LaunchSignup({ location, heading = 'Get notified when UNICORN launches', button = 'Get the launch alert', compact = false }: { location: Location; heading?: string; button?: string; compact?: boolean }) {
  const id = useId(), panel = useRef<HTMLDivElement>(null), email = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [source, setSource] = useState<Location>(location);
  const entry = () => (panel.current?.dataset.entryLocation || location) as Location;
  const started = () => track('email_signup_started', entry());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'submitting') return;
    const form = new FormData(event.currentTarget), where = entry();
    started(); setState('submitting'); setMessage(''); setSource(where);
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const { sessionId, attribution } = getVisit();
      const response = await fetch('/api/launch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ email: String(form.get('email') || '').trim(), website: form.get('website') || '', consent: true, sessionId, attribution, location: where }) });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || 'We couldn’t save your email. Please try again.');
      setState('success');
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error && error.name !== 'AbortError' && error.message !== 'Failed to fetch' ? error.message : 'We couldn’t confirm your signup. Check your connection and try again; we’ll never add you twice.');
      email.current?.focus();
    } finally { clearTimeout(timeout); }
  }
  return <div ref={panel} className={'launch-signup' + (compact ? ' compact-signup' : '')} data-launch-signup={location}>
    {state === 'success' ? <div className="launch-success" role="status" aria-live="polite">
      <span className="success-icon"><Check size={22}/></span><h3>You’re in.</h3>
      <p>You’ll be one of the first to know when UNICORN launches.</p>
      <p className="success-next">One more thing: follow UNICORN on Kickstarter so Kickstarter also notifies you the moment we launch.</p>
      <KickstarterLink location={source} className="button lime success-cta">Follow UNICORN on Kickstarter <ArrowUpRight size={19}/></KickstarterLink>
      <span className="early-note">Done already? You’re officially early.</span>
    </div> : <>
      <h3 id={id+'-heading'}>{heading}</h3>
      <form onSubmit={submit} aria-labelledby={id+'-heading'} aria-busy={state === 'submitting'}>
        <label className="visually-hidden" htmlFor={id+'-email'}>Email address</label>
        <div className="launch-input-row"><input ref={email} id={id+'-email'} name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="Enter your email" required maxLength={254} onFocus={started} aria-invalid={state === 'error'} aria-describedby={id+'-note'+(state === 'error' ? ' '+id+'-error' : '')}/>
          <button type="submit" className="button lime" disabled={state === 'submitting'}>{state === 'submitting' ? 'Saving your spot…' : button}<ArrowRight size={17}/></button></div>
        <div className="signup-honeypot" aria-hidden="true"><label htmlFor={id+'-website'}>Leave this field empty</label><input id={id+'-website'} name="website" tabIndex={-1} autoComplete="off"/></div>
        <p className="launch-note" id={id+'-note'}>No spam. Just launch day + major UNICORN updates.</p>
        {state === 'error' && <p className="launch-error" id={id+'-error'} role="alert">{message}</p>}
      </form>
      <KickstarterLink location={location}/>
      <span className="signup-privacy">By signing up, you agree to these emails. Unsubscribe anytime. <a href="#privacy">Privacy</a></span>
    </>}
  </div>;
}

export function ContextSignup({ location, title, label = 'Get the launch alert', eyebrow = 'THE NEXT BIG THING AT GAME NIGHT' }: { location: Location; title: string; label?: string; eyebrow?: string }) {
  return <aside className="context-signup wrap"><div className="context-inner"><div><span className="eyebrow"><Sparkles size={15}/>{eyebrow}</span><h2>{title}</h2></div><LaunchSignup location={location} heading="Get in early. Bring your friends." button={label} compact/></div></aside>;
}

export function FunnelTracking() {
  useEffect(() => {
    track('landing_page_view');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) track('cta_view', (entry.target.getAttribute('data-launch-signup') || 'nav') as Location);
    }, { threshold: .5 });
    document.querySelectorAll('[data-launch-signup], .nav-cta').forEach(el => observer.observe(el));
    let scheduled = false;
    const measure = () => {
      scheduled = false;
      const distance = document.documentElement.scrollHeight - innerHeight;
      if (distance <= 0) return;
      const progress = scrollY / distance;
      if (progress >= .5) track('scroll_50');
      if (progress >= .9) track('scroll_90');
    };
    const onScroll = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(measure); } };
    window.addEventListener('scroll', onScroll, { passive: true }); measure();
    return () => { window.removeEventListener('scroll', onScroll); observer.disconnect(); };
  }, []);
  return null;
}

export function StickyLaunchBar() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const hero = document.getElementById('hero');
    if (!hero) return;
    let queued = false;
    const update = () => {
      queued = false;
      const editing = document.activeElement instanceof HTMLInputElement;
      const formVisible = [...document.querySelectorAll<HTMLElement>('[data-launch-signup]')].some(form => { const r = form.getBoundingClientRect(); return r.top < innerHeight - 80 && r.bottom > 100; });
      const show = hero.getBoundingClientRect().bottom < 0 && !formVisible && !editing;
      setVisible(show);
      if (show) track('cta_view', 'sticky');
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    document.addEventListener('focusin', queue); document.addEventListener('focusout', queue);
    update();
    return () => { window.removeEventListener('scroll', queue); window.removeEventListener('resize', queue); document.removeEventListener('focusin', queue); document.removeEventListener('focusout', queue); };
  }, []);
  return <div className={'sticky-launch'+(visible ? ' is-visible' : '')} inert={!visible} aria-hidden={!visible}><div><span><Sparkles size={18}/> UNICORN is coming to Kickstarter</span><button type="button" className="button lime" onClick={() => focusSignup('sticky')}>Get launch alert</button><KickstarterLink location="sticky"/></div></div>;
}

export function PlaytestProof() {
  return <section className="section wrap playtest-proof" id="real-players"><div className="section-heading"><div><div className="eyebrow">HANDMADE CARDS. VERY REAL BETRAYALS.</div><h2 className="section-title">Tested on<br/><span>real friendships.</span></h2></div><p className="section-copy">UNICORN has already escaped the spreadsheet.<br/><br/>We’ve been putting handmade prototypes in front of real players, watching alliances form, companies grow, and friendships deteriorate exactly as intended.</p></div>
    <div className="proof-grid"><figure className="proof-video"><video controls playsInline preload="none" poster="/images/playtest/trailer-poster.webp" width="1280" height="720" onPlay={() => track('gameplay_video_play', 'playtest')} aria-label="UNICORN trailer with real playtest footage and creators Yash and Manav"><source src="/videos/unicorn-playtest.mp4" type="video/mp4"/><track kind="captions" src="/videos/unicorn-trailer.vtt" srcLang="en" label="English"/>Your browser cannot play this video.</video><figcaption>Meet the game. Then meet the people making it.</figcaption></figure>
      <div className="proof-photos"><figure><img src="/images/playtest/at-the-table.webp" width="800" height="600" loading="lazy" decoding="async" alt="Friends gathered around the table playing the handmade UNICORN prototype"/><figcaption>The first prototypes, out in the wild.</figcaption></figure><figure><img src="/images/playtest/handmade-cards.webp" width="800" height="600" loading="lazy" decoding="async" alt="A player considering their hand during a UNICORN playtest"/><figcaption>Everyone has a plan. Until someone plays a card.</figcaption></figure></div></div>
  </section>;
}

export function PrivacyNote() {
  return <details className="funnel-privacy wrap" id="privacy"><summary>Your email, your call. <span>Privacy & launch updates</span></summary><p>UNICORN uses your email to send the launch announcement and major game updates. We store it securely with Cloudflare, along with when and where you joined, and don’t sell it. Every update will include an unsubscribe link.</p><p>We use first-party visit and conversion statistics to see which campaigns and parts of this page work. These include a random visit ID, CTA location and ad campaign tags, never your email. No advertising pixels or cross-site tracking cookies are used. Rate limiting uses a short-lived hash, not a stored IP address.</p><p>To remove your email or ask about your data, <a href={kickstarter} target="_blank" rel="noopener noreferrer">contact Yash through the UNICORN Kickstarter creator profile</a>. Following on Kickstarter is always optional.</p></details>;
}
