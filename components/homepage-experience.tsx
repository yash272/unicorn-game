'use client';
/* eslint-disable @next/next/no-img-element */
import { lazy, Suspense, useState } from 'react';
import { ArrowRight, ArrowUpRight, RotateCcw } from 'lucide-react';
import { KickstarterLink } from './launch-funnel';
import { focusSignup } from '../lib/funnel-client';
const TableDemo = lazy(() => import('./table-demo'));

type FeaturedCard = { key: string; name: string; category: string; value: number; effect: string; flavor: string; outcome?: {headline: string; caption: string} };
const stories: Record<string, {kind: string; hook: string; text: string}> = {
  'rockstar-cto': {kind:'BUILD', hook:'Hire them before your friend does.', text:'A $100M boost, sitting right there in your startup. Everyone can see what it’s worth.'},
  'poach': {kind:'ATTACK', hook:'Their best hire. Your newest employee.', text:'Take a card from a rival’s startup. They lose its value. You gain it. Eye contact is optional.'},
  'founder-scandal': {kind:'ATTACK', hook:'You get to see everything.', text:'Privately look at their entire hand. Choose one card to steal. Leave them wondering what you’re planning.'},
  'pr-crisis': {kind:'ATTACK', hook:'The apology needs an apology.', text:'Knock $75M off a rival’s valuation. The penalty stays on their table until Crisis PR Team clears it.'},
  'patent-lawsuit': {kind:'ATTACK', hook:'See you in court. We’ll keep playing.', text:'Make a rival skip their next whole turn. Unless, of course, they have the right lawyers.'},
  'golden-handcuffs': {kind:'DEFEND', hook:'Nice offer. They’re staying.', text:'Cancel a Poach before your card changes hands. This is why you kept one card back.'},
  'investor': {kind:'DEAL', hook:'I believe in you. And that card.', text:'Give a rival $50M in valuation. Take one random card from their hand in return. They can refuse with Not For Sale.'},
};

export function CardSpotlight({cards}: {cards: FeaturedCard[]}) {
  const [selected, setSelected] = useState('founder-scandal');
  const card = cards.find(c => c.key === selected)!;
  const story = stories[selected];
  return <div className="card-spotlight"><div className="card-picker" role="group" aria-label="Choose a card to read">{cards.map(c=><button type="button" key={c.key} aria-pressed={selected===c.key} onClick={()=>setSelected(c.key)}><small>{stories[c.key].kind}</small>{c.name}</button>)}</div><div className="spotlight-layout" id="featured-card"><div className="spotlight-art"><img key={card.key} src={'/cards/edition-07/'+card.key+'.webp'} width="540" height="756" loading="lazy" decoding="async" alt={`${card.name}. ${card.effect} Bank instead for $${card.value}M.`}/><span>From the current print deck.</span></div><div className="spotlight-story" aria-live="polite"><span className="eyebrow">{story.kind} / {card.name.toUpperCase()}</span><h3>{story.hook}</h3><p>{story.text}</p><div className="effect-in-words"><span>THE EFFECT</span><strong>{card.outcome?.headline || `+$${card.value}M`}</strong></div><p className="card-footnote">{card.outcome?'Keep the effect for the right moment, or bank the small value printed in the corner.':'Play face-up. Add the value. Keep an eye on everyone else’s hand.'}</p></div></div></div>;
}

export function BetrayalMoment() {
  const [outcome,setOutcome] = useState<'ready'|'stolen'|'blocked'>('ready');
  const stolen = outcome==='stolen';
  return <section className="betrayal-section" id="the-moment"><div className="wrap betrayal-layout"><div className="betrayal-copy"><div className="eyebrow">A PERFECTLY GOOD COMPANY. A TERRIBLE FRIEND.</div><h2>Your startup<br/>is worth <span>$900M.</span><br/><em>Your friend just<br/>stole your CTO.</em></h2><p>You’re one move away from becoming a unicorn.<br/>Unfortunately, everyone else knows it too.</p><div className="moment-links" data-cta-location="betrayal"><KickstarterLink location="betrayal" className="text-button"/><button type="button" className="text-button" onClick={()=>focusSignup('betrayal')}>Get launch alert <ArrowRight size={15}/></button></div></div>
    <div className={'betrayal-example is-'+outcome}><div className="moment-scoreboard"><div><span>YOUR STARTUP</span><strong>${stolen?'800':'900'}<small>M</small></strong><b>{stolen?'−$100M':'ONE MOVE AWAY'}</b></div><span className="moment-versus">vs.</span><div><span>YOUR FRIEND</span><strong>${stolen?'750':'650'}<small>M</small></strong><b>{stolen?'+$100M':'NICE CTO.'}</b></div></div><div className="moment-cards"><img className="moment-cto" src="/cards/edition-07/rockstar-cto.webp" width="540" height="756" loading="lazy" alt="Rockstar CTO, $100M valuation"/><img className="moment-attack" src={outcome==='blocked'?'/cards/edition-07/golden-handcuffs.webp':'/cards/edition-07/poach.webp'} width="540" height="756" loading="lazy" alt={outcome==='blocked'?'Golden Handcuffs cancels the Poach':'Poach takes the CTO from your startup'}/></div><p className="moment-result" role="status">{outcome==='ready'?'They play Poach. Do you have a defense?':stolen?'Your CTO changes sides. So does the $100M.':'Golden Handcuffs cancels Poach. Your CTO stays.'}</p><div className="moment-controls">{outcome==='ready'?<button type="button" className="button coral-button" onClick={()=>setOutcome('stolen')}>Let them play Poach <ArrowRight size={17}/></button>:<button type="button" className="text-button" onClick={()=>setOutcome('ready')}><RotateCcw size={15}/> Reset</button>}{outcome!=='blocked'&&<button type="button" className="button moment-defense" onClick={()=>setOutcome('blocked')}>Try Golden Handcuffs</button>}</div><span className="moment-caption">One example turn. Two very different outcomes.</span></div>
  </div></section>;
}

export function PrototypeDemo() {
  const [opened,setOpened] = useState(false);
  return <div className="prototype-demo"><div className="online-trial-link"><a href="/play" className="text-button">Play online trial <ArrowUpRight size={17}/></a><span>Earlier 98-card prototype, including alliances. The current print playtest has 64 cards.</span></div><details onToggle={e=>{if(e.currentTarget.open)setOpened(true)}}><summary>Try more table moments <ArrowRight size={17}/></summary>{opened&&<Suspense fallback={<p className="demo-loading" role="status">Dealing the example…</p>}><TableDemo/></Suspense>}</details></div>;
}
