# Homepage refresh: 11 October 2026

## Prioritized diagnosis before implementation

1. **The first screen hides the physical game.** The floating HTML cards, thin generic line icons, glow and orbit decoration look like software illustrations. The violet, lime, strong condensed type and overlapping cards already work; keep those and bring real table photography and the printed card artwork into the hero.
2. **The emotional hook arrives too late.** Five rule steps, an accounting panel and thirteen sample cards precede real players. Move a short $900M/CTO interaction above the rules. Show the consequence instead of adding more explanations.
3. **Too much of the page repeats one pattern.** A headline, small paragraph, equal grid and complete signup form recur. Replace repeated forms with compact contextual links, curate the card selection, and vary the composition with real photos and a short origin story.
4. **The origin is missing.** Existing genuine playtest and handmade-prototype material can establish authorship without synthetic product renders, invented quotes or claims about finished manufacturing.
5. **The rules editions differ.** The live multiplayer engine and scripts are Edition 04 (98 cards); the latest approved physical draft is Edition 07 (64). Feature current printed artwork, preserve the earlier prototype separately, and identify that distinction where people choose the online trial. Do not rewrite the game engine as part of a homepage design task.

## Direction

Preserve Barlow Condensed for display and DM Sans for body/controls. Keep ink `#0c0a10`, violet `#ae91ff`, lime `#ddfa83`, coral `#ff806c` and cyan `#87d4ee`; introduce the cards' existing paper `#f5f0e6` in selected sections. Use the actual photos' purple tablecloth as a bridge between brand and human material. Avoid added gradients, generated art and decorative dashboards.

Desktop: premise + Kickstarter/email at left; real table photo with overlapping printed cards at right. Mobile: premise, readable table/card visual, primary Kickstarter action and a compact email row. Signature: a $900M startup loses a $100M CTO, visibly dropping to $800M while the thief gains $100M. A matching defense demonstrates the alternative. This is a labeled example, not a quote or claimed record of the pictured session.

## Existing architecture to preserve

Vinext App Router on Vite, React 19, Cloudflare Worker and existing D1 binding. GitHub `main` is connected to Workers Builds. No new infrastructure, animation package or analytics service is needed.

`LaunchSignup` posts to `/api/launch`; `handleFunnel` validates, checks same-origin and rate limits, normalizes email, saves consent/attribution and atomically records a new signup. Duplicate addresses return the same success without a second completion. `getVisit` retains UTMs in a 30-minute tab visit and `KickstarterLink` forwards them. Three `/ivey-*` handlers preserve the poster experiment. These mechanisms and storage remain unchanged.

## Remaining human assets

The typography and category colors are consistent, but the old website's icon-based cards differ from the printed cards. Use the exact current PDF artwork on the homepage. Commission a small, coherent illustration series for the physical deck only after agreeing the print edition: a CTO, a founder under scrutiny, a lawsuit and a PR disaster are useful first samples. Do not replace the whole deck with a new style without approval.

Useful future shoot: one wide table scene in good daylight, a close shot of hands playing the current cards, and the finished physical deck/box once production samples actually exist. Existing prototype photographs are authentic and usable now. No box render is presented as manufactured product.

## Ten changes delivered

1. Replaced the hero's icon mockups and orbital decoration with a real table photo and exact current printed CTO/Poach artwork.
2. Made the $1B objective explicit in the headline and Kickstarter the primary action, with email still available immediately.
3. Added an interactive $900M theft example that conserves the stolen CTO's $100M between the two players and shows the defense alternative.
4. Condensed the visible rules into draw one, play up to two, build/attack and reach $1B; deeper rules remain available on demand.
5. Curated seven cards with their exact printed effects, readable text descriptions and accessible tap/click selection.
6. Brought real people into the first screen and strengthened the playtest section with real photos, a photo video poster and native video controls.
7. Added a concise Yash/Manav origin section using the selected creator photo and the real card-making video frame.
8. Introduced the existing print palette's paper color, physical card shadows and slightly irregular photo compositions without changing the brand fonts/colors.
9. Replaced repeated full-form panels with contextual Kickstarter/email links, and kept the sticky CTA away from gameplay controls and video.
10. Added a clear valuation finish line, current 64-card PDF downloads and a deferred, labeled earlier online prototype so existing interactions remain available.

## Messaging hierarchy and conversion

The Startup Card Game → Build a $1B startup. Betray your friends. → real table/card visual → Follow on Kickstarter / See how it plays / optional email → $900M theft → simple turn loop → seven cards → real playtests → visible race to $1B → handmade origin → Kickstarter and launch list.

Visitors can go directly to Kickstarter from the header, hero, contextual links, sticky bar or closing section. Email stays inline, posts to the same real endpoint, and shows the Kickstarter next step after success. Focus links preserve their original CTA location even when they open a different form. No email gate, forced popup, countdown, invented review, follower count or manufacturing claim was introduced.

All existing events remain: `landing_page_view`, `email_signup_started`, server-only `email_signup_completed`, `kickstarter_click`, `gameplay_video_play`, `scroll_50`, `scroll_90`, `cta_view`, and server-derived `poster_qr_visit`. Contextual link groups now participate in the existing CTA view tracking. Event names, database schema, UTM values, reporting definitions and Ivey redirect behavior are unchanged.

## Validation and limits

- 52 unit/storage/gameplay tests passed; four real local Worker multiplayer integration tests passed.
- TypeScript, lint and the production build passed.
- Eight viewport sizes were exercised: 320x740, 360x800, 375x667, 390x844, 412x915, 768x1024, 1024x768 and 1440x1000. A 320px grid overflow discovered by that test was fixed at its source.
- The hero's photo/cards, email field and Kickstarter button fit the tested phone screens. Email inputs remain 16px with mobile email keyboards. These are browser viewport checks, not physical-device testing.
- All three Ivey routes completed real signup flows at both mobile sizes. Read-only D1 checks confirmed one subscriber, one poster visit and one completion per test visit, with correct variant and no duplicate signup.
- Direct and post-signup Kickstarter paths preserved UTMs. Failure/retry retained the email and never showed false success. Sticky focus preserved CTA attribution; video/scroll events, card selection, theft/defense, deferred examples and the online lobby passed browser checks.
- Production QA uses `qa-*` campaigns and reserved `example.com` addresses, which existing exports/reports exclude.
- Detailed evidence is in ignored `work/homepage-qa-*/`; repeat with `PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs node tests/homepage.browser.mjs http://127.0.0.1:8827`. Then use `node tests/ivey-storage.mjs work/homepage-qa-.../results.json` (`--remote` only for a production run).

The test proves the flows work. It does not prove higher conversion, a measured game duration, physical-device performance, or that every visitor will prefer the art direction. Kickstarter clicks still do not prove completed Kickstarter follows.

## Performance and changed files

The same eight font faces were converted from TTF to WOFF2: 542,608 bytes became 208,812 bytes (61.5% smaller across the font files). The original TTF files remain as fallbacks and for existing print workflows. The preloaded display face now uses WOFF2. No production dependency was added; local font conversion tooling lives in ignored `work/`.

Photographs use responsive, compressed WebP files. The phone hero photo is about 47 KB. Below-the-fold images are lazy-loaded, the existing video uses `preload="none"` and its poster is deferred until the video approaches the viewport, and the older table demo is imported only when opened. The visible page is server-rendered, with client code limited to existing conversion components and actual interactions. No new tracking vendor or animation library was added.

Main files: `app/page.tsx`, `app/tabletop.css`, `app/globals.css`, `app/layout.tsx`, `components/homepage-experience.tsx`, `components/table-demo.tsx`, `components/launch-funnel.tsx`, and `content/print-edition.json`. Assets are in `public/cards/edition-07/`, `public/images/playtest/`, `public/downloads/` and `public/fonts/`. Repeatable browser coverage is in `tests/homepage.browser.mjs`; the existing D1 verification tool remains unchanged.

The original category colors, fonts, logo, card designs, existing gameplay engine, signup backend, consent handling, event schema, UTM handling, poster redirects and Cloudflare deployment configuration are preserved. The older scenario component was extracted and deferred, not deleted.
