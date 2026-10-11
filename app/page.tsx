/* Photos and card artwork are pre-sized WebP files, with no runtime image service. */
/* eslint-disable @next/next/no-img-element */
import { ArrowRight, ArrowUpRight, Sparkles, Download } from 'lucide-react';
import { ContextSignup, FunnelTracking, KickstarterLink, LaunchSignup, PlaytestProof, PrivacyNote, StickyLaunchBar } from '../components/launch-funnel';
import { BetrayalMoment, CardSpotlight, PrototypeDemo } from '../components/homepage-experience';
import printEdition from '../content/print-edition.json';

const featuredKeys = ['rockstar-cto', 'poach', 'founder-scandal', 'pr-crisis', 'patent-lawsuit', 'golden-handcuffs', 'investor'];
const featuredCards = featuredKeys.map(key => printEdition.cards.find(card => card.key === key)!);

export default function Home() {
  return <div className="tabletop-home">
    <FunnelTracking/>
    <a href="#main" className="skip-link">Skip to the game</a>
    <header className="site-header wrap"><a className="brand" href="#hero" aria-label="UNICORN home"><Sparkles fill="currentColor"/> UNICORN<span>™</span></a><nav aria-label="Main navigation"><a href="#how-it-works">How to play</a><a href="#cards">The cards</a><KickstarterLink location="nav" className="nav-cta"/></nav></header>
    <main id="main">
      <section className="hero wrap human-hero" id="hero">
        <div className="hero-copy">
          <div className="eyebrow">THE STARTUP CARD GAME</div>
          <h1 className="funnel-headline">Build a $1B startup.<br/><span>Betray your friends.</span></h1>
          <p className="hero-description">Hire a CTO. Launch a product. Try to survive the people at your table.</p>
          <div className="game-meta funnel-meta"><span>3–5 players</span><span title="Playtest target; duration is still being tested">~45 minutes</span><span>First to $1B wins</span></div>
          <div className="hero-actions" data-cta-location="hero"><KickstarterLink location="hero" className="button lime hero-kickstarter"/><a href="#how-it-works" className="hero-how">See how it plays <ArrowRight size={16}/></a></div>
          <LaunchSignup location="hero" heading="Or get the launch alert" button="Notify me" showKickstarter={false}/>
        </div>
        <div className="hero-table">
          <figure className="table-photo"><img src="/images/playtest/table-reactions-1200.webp" srcSet="/images/playtest/table-reactions-640.webp 640w, /images/playtest/table-reactions-1200.webp 1200w" sizes="(max-width: 800px) 100vw, 48vw" width="1200" height="900" fetchPriority="high" alt="Players holding UNICORN cards around a purple table during a real prototype playtest"/><figcaption>Handmade cards. Very real competition.</figcaption></figure>
          <img className="hero-printed-card hero-cto" src="/cards/edition-07/rockstar-cto.webp" width="540" height="756" alt="Rockstar CTO card, worth $100M"/>
          <img className="hero-printed-card hero-poach" src="/cards/edition-07/poach.webp" width="540" height="756" alt="Poach card: take one card from a rival’s startup"/>
          <span className="table-photo-note">Friendship is a liability.</span>
        </div>
      </section>
      <div className="table-ribbon" aria-label="The goal of the game"><span>ONE TABLE.</span><span>3–5 STARTUPS.</span><strong>ONE BILLION-DOLLAR WINNER.</strong></div>
      <BetrayalMoment/>
      <HowItPlays/>
      <ContextSignup location="how-to-play" title="Think you can get there first?" eyebrow="YOUR NEXT GAME NIGHT"/>
      <section className="section cards-section" id="cards"><div className="wrap"><div className="section-heading"><div><div className="eyebrow">SMALL CARDS. BIG CONSEQUENCES.</div><h2 className="section-title">There goes<br/><span>your perfectly good plan.</span></h2></div><p className="section-copy">A stolen employee. A leaked hand. A lawsuit at exactly the wrong time.<br/>Pick a card. See what it does.</p></div><CardSpotlight cards={featuredCards}/></div></section>
      <PlaytestProof/>
      <ContextSignup location="playtest" title="Bring this to your table." eyebrow="COMING TO KICKSTARTER"/>
      <ValuationRace/>
      <OriginStory/>
      <section id="playtest" className="section wrap playtest-section"><div className="playtest-copy"><span className="eyebrow">THE FIRST EDITION IS NEXT.</span><h2 className="section-title">Bring your friends.<br/><span>Watch your back.</span></h2><p>We’re turning the handmade prototype into a polished first edition. Follow UNICORN on Kickstarter to be there when it launches.</p><KickstarterLink location="bottom" className="button lime"/></div><div className="signup-panel"><LaunchSignup location="bottom" heading="Keep me in the loop." button="Get the launch alert"/></div></section>
      <PrivacyNote/>
    </main>
    <footer className="footer wrap"><a className="brand" href="#hero"><Sparkles fill="currentColor"/> UNICORN<span>™</span></a><p>Big dreams. Small cards. Questionable ethics.</p><span>THE STARTUP CARD GAME</span></footer>
    <StickyLaunchBar/>
  </div>;
}

function HowItPlays() {
  return <section id="how-it-works" className="section wrap how-section"><div className="section-heading"><div><div className="eyebrow">THE TABLE WILL TEACH YOU THE REST.</div><h2 className="section-title">Build your company.<br/><span>Interrupt everyone else.</span></h2></div><p className="section-copy">A social strategy card game about startup ambition and badly timed betrayals.</p></div>
    <div className="quick-play" aria-label="Your turn"><span>DRAW <b>1 CARD</b></span><ArrowRight aria-hidden="true"/><span>PLAY UP TO <b>2 CARDS</b></span><ArrowRight aria-hidden="true"/><span>YOUR CHOICE <b>BUILD OR ATTACK</b></span><ArrowRight aria-hidden="true"/><span>THE GOAL <b>FIRST TO $1B</b></span></div>
    <div className="play-moves"><article><span className="move-word">BUILD.</span><h3>Give them something to envy.</h3><p>Hire talent. Launch products. Put your cards on the table and grow your valuation.</p><span className="move-value">+$100M</span></article><article><span className="move-word">STEAL.</span><h3>Their CTO looks expensive.</h3><p>Take an employee. Peek at a hand and steal the best card. Make someone miss a turn.</p><span className="move-value">YOUR CARD. MY STARTUP.</span></article><article><span className="move-word">FIGHT BACK.</span><h3>Keep a defense up your sleeve.</h3><p>Cancel a Poach. Call your lawyers. Hold the right card until someone makes their move.</p><span className="move-value">NICE TRY.</span></article></div>
    <details className="rules-details"><summary>A few things before you deal. <span>Quick rules <ArrowRight size={17}/></span></summary><div className="rule-content"><div><h4>Your company, your hand</h4><p>Start at $50M with five hidden cards. Draw one each turn and keep at most seven in hand.</p></div><div><h4>Two plays. Your choice.</h4><p>Play a card for its effect or place it face-up for its printed valuation. Defenses react from your hand without using a play.</p></div><div><h4>First to $1B</h4><p>Add the values in your startup and subtract active penalties. Reach $1B at the end of your turn to win.</p></div></div><div className="downloads"><a href="/downloads/UNICORN-Edition-07-Rules-and-Changes.pdf" className="text-button" download><Download size={17}/> Current print rules</a><a href="/downloads/UNICORN-Edition-07-Print-and-Play.pdf" className="text-button" download><Download size={17}/> Print the 64-card playtest deck</a></div></details>
  </section>;
}

function ValuationRace() {
  return <section className="section race-section"><div className="wrap"><div className="section-heading"><div><div className="eyebrow">EVERYONE CAN SEE WHO’S WINNING.</div><h2 className="section-title">And who needs<br/><span>to be stopped.</span></h2></div><p className="section-copy">The closer you get to a billion, the more interested your friends become in your company.</p></div>
    <div className="race-track" aria-label="Valuation milestones from fifty million to one billion"><span>$50M<small>YOUR STARTUP</small></span><span>$250M</span><span>$500M</span><span>$750M</span><span className="race-danger">$900M<small>WATCH YOUR BACK</small></span><strong>$1B<small>UNICORN</small></strong></div>
    <PrototypeDemo/>
  </div></section>;
}

function OriginStory() {
  return <section className="section origin-section" id="our-story"><div className="wrap origin-layout"><div className="origin-photos"><figure><img src="/images/playtest/yash-making-cards.webp" width="640" height="800" loading="lazy" decoding="async" alt="Yash smiling while cutting the first UNICORN cards by hand"/><figcaption>Yash, on card-cutting duty.</figcaption></figure><figure><img src="/images/playtest/manav-making-cards.webp" width="640" height="640" loading="lazy" decoding="async" alt="Manav in the video of the founders making their first cards"/><figcaption>Manav, before the first test.</figcaption></figure></div><div><div className="eyebrow">MADE BY YASH & MANAV.</div><h2 className="section-title">First, we needed<br/><span>a pair of scissors.</span></h2><p>Before UNICORN was a deck, it was paper, glue, and two founders making the cards themselves.</p><p>We took that handmade prototype to real tables. Players stole cards, argued over their next move, and showed us what needed to change.</p><p>We’re still testing. Now we’re working toward a polished first edition, with the same ambition: a game you want to play again with the people who just ruined your company.</p><a href="#real-players" className="text-button">See it at the table <ArrowUpRight size={17}/></a></div></div></section>;
}
