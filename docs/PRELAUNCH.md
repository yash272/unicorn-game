# UNICORN prelaunch operations

## Where signups live

Production email addresses are in your existing **Cloudflare D1 `unicorn-game` database**, table **`launch_subscribers`**, bound as `DB`. Database ID: `2c66c0a3-c0ca-49dc-8cb4-07a5c36b4f61`. The multiplayer `game_rooms` table is unchanged. Local development uses a separate local D1 database.

Each subscriber has a normalized, unique email, signup time, explicit consent version, first signup CTA, visit ID and campaign attribution. There is no public endpoint for reading or exporting the list. Access requires your Cloudflare account. Do not put exports in `public/`, email them indiscriminately, or commit them to Git.

The same-origin `POST /api/launch` validates the email and consent, checks a honeypot, bounds request size and rate limits bursts. A database failure shows a retryable error. Duplicate addresses receive the same success message and never add a second lead or completion. Submitting the form again is a new explicit opt-in and reactivates a locally suppressed address, without counting it as a new acquisition. Your email sending service’s suppression list must still be respected. Email ownership is not verified with double opt-in.

## Export the list

From this repository, with your existing Cloudflare login:

```sh
npm run leads:export
```

This creates a CSV in **`unicorn-site/.exports/`**, prints its full path, restricts file permissions, and never prints contacts to the terminal. That folder is ignored by Git. Only subscribed contacts are exported; test campaigns beginning `qa-` are excluded. Rows are fetched in batches so the exporter also works as the list grows. Open the printed path in Finder using **Go → Go to Folder**.

If login expires, run `npx wrangler login` and sign in to the Cloudflare account that owns the Worker. You can also view the table through Cloudflare → Storage & databases → D1 → unicorn-game → Studio.

## Send the launch reminder later

No email is automatically sent by this website yet. Signup consent covers the launch and major UNICORN updates; the on-screen confirmation is immediate.

1. Export the list immediately before sending.
2. Import the CSV into your chosen email campaign service as the UNICORN launch list. Map `email` to its email field and retain the signup date and consent version. Respect any suppression records already in that service.
3. Verify your sender address/domain in that service, add its unsubscribe link and required sender details, and send a test to yourself.
4. Send the launch announcement with the Kickstarter URL. Use that service for unsubscribe handling and future campaigns; never override its suppression list with a later CSV import.

If someone asks you directly to stop emails, suppress them in the sending service and here:

```sh
npm run leads:suppress -- --email=person@example.com
```

For data-removal requests, delete the matching row through authenticated D1 Studio after verifying the request, and remove it from your sending service and private exports. The website's privacy disclosure directs people to your Kickstarter creator contact. Do not use D1 Studio's sharing features to expose this database.

## Funnel reporting

```sh
npm run funnel:report
```

Shows overall visit-to-email and visit-to-Kickstarter-click percentages, results by CTA location, and source/medium/campaign/creative breakdowns. Data is first-party in **`funnel_events`**. There are no Meta pixels, external analytics scripts, fingerprinting, email addresses in event rows, or persistent advertising cookies. This report does **not** send conversions to Meta Ads Manager or optimize Meta campaigns automatically.

Events:

| Event | When it records |
| --- | --- |
| `landing_page_view` | Landing page loads in the browser |
| `email_signup_started` | A signup email field is focused or submitted |
| `email_signup_completed` | The server successfully inserts a new email, in the same database transaction |
| `kickstarter_click` | Any tracked campaign link is clicked, including after signup |
| `gameplay_video_play` | The real trailer starts playing |
| `scroll_50`, `scroll_90` | Visitor passes that fraction of the scrollable page |
| `cta_view` | At least half of a signup panel is visible, or the sticky/nav CTA is visible |

Locations: `hero`, `how-to-play`, `betrayal`, `playtest`, `bottom`, `sticky`, `nav`; page-wide events use `page`. Sticky/nav signup buttons focus the closest email form and retain their own location attribution. CTA conversion is completed signup visits divided by CTA-view visits. A visitor can see multiple CTAs, so location counts should not be added to derive total visitors.

A random visit ID lasts up to 30 minutes in tab-scoped sessionStorage, falling back to memory when storage is blocked. Events are deduplicated by visit/event/location. Refreshing the tab in that interval doesn't inflate counts. UTM values are captured on entry, retained during scrolling and signup, stored with events and new subscribers, and forwarded to the Kickstarter link. A new tagged campaign creates a new visit. Query parameters are never removed from the landing page URL. Only the referrer's hostname is recorded, not its private path/query. Rate-limit hashes expire after two minutes and are cleaned on the next request; raw IPs aren't saved.

**Limits:** a Kickstarter click is not a verified follow; those happen on another website. Script blocking, disconnected browsers and bots can affect browser analytics. The report is operational first-party tracking, not a billing-grade or fraud-proof ad measurement system. Server completion counts only new emails, so returning subscribers see success without inflating acquisition counts. The report is all-time; use D1 Studio with `created_at` filters for a date-specific analysis. QA campaigns (`qa-*`) are excluded from exports and reporting.

## Test the complete funnel

1. Visit `https://unicorn-game.yvs272.workers.dev/?utm_source=instagram&utm_medium=paid_social&utm_campaign=qa-funnel&utm_content=mobile-test` on a phone. Also check at 320px, 390px and a desktop width. Email fields use the email keyboard and at least 16px text.
2. Tap a Kickstarter link before entering any email. It should open the supplied campaign with the UTM tags intact.
3. Submit a new test email in the hero. Stay on the same page, see “You’re in.”, and follow the success-state Kickstarter button. This stores an actual QA contact, excluded from export.
4. Submit the same email again, including uppercase. It should succeed without creating another record or completion.
5. Scroll through the interactive cards and demo. The sticky bar appears beyond the hero and hides around visible forms or an active input. Test a second email using a later CTA and another via the sticky button.
6. Play the trailer and scroll to the bottom. Check the `funnel_events` table in D1 Studio for the test campaign and the seven requested events plus CTA views. Check `launch_subscribers` for your test addresses and attribution.
7. In browser developer tools, take the network offline and submit another address. It must show an error, retain the email and allow retry, while the Kickstarter link remains visible. Re-enable the network afterward.
8. Confirm `/play` still loads and the inline table scenarios still change valuation. No card artwork or gameplay rules were changed.

Developer validation:

```sh
npm test
npx tsc --noEmit
npm run lint
npm run db:migrate:local
npm run build
npm start -- --port 8795
```

Use `npm run leads:export -- --local` and `npm run funnel:report -- --local` to inspect local development. Never send test emails from production reports.

## Deploy and prepare ad links

The additive migration `drizzle/0001_launch_funnel.sql` creates the three new tables. It doesn't modify game storage. Cloudflare Builds should use **build: `npm run build`** and **deploy: `npm run deploy`**, so migrations apply before the new Worker runs. No new secrets, bindings, database subscriptions or marketing dependencies are needed.

Example ad destination:

```text
https://unicorn-game.yvs272.workers.dev/?utm_source=instagram&utm_medium=paid_social&utm_campaign=unicorn_prelaunch&utm_content=gameplay_video_1
```

Use a distinct `utm_content` for each creative. Run `npm run funnel:report` to compare them. Only the existing local fonts, HTML, CSS and JavaScript load above the fold; WebP playtest photos are lazy-loaded, and the ~3 MB trailer uses `preload="none"` with a small poster. The deck art and interactive examples remain intact.

## Release verification (5 October 2026)

The production build passed 43 automated gameplay/signup tests and four real Worker multiplayer integration tests. A browser test page passed 37 checks spanning 320, 360, 390, 412, 768, 1024 and 1440px layouts, a real local D1 signup, duplicate signup, a simulated network failure and recovery, UTM handoff, sticky CTA focus, trailer playback, deferred video loading, decoded photos and the interactive Poach example. The test page is a local-only artifact and is not deployed. TypeScript, lint and the production build also pass. This is browser viewport testing, not a claim of testing physical iPhone/Android hardware.

## Ivey offline experiment

The three permanent `/ivey-build`, `/ivey-cto` and `/ivey-billion` routes redirect to the same homepage with distinct campaign tags. `poster_qr_visit` is derived server-side from the existing landing event. No migration or extra analytics service is needed. Run `npm run ivey:report` for the campaign's A/B/C report, or add `-- --qa` for isolated test traffic. See [the poster kit and experiment instructions](../marketing/ivey/README.md) for printing, placement, metric definitions and repeatable QA.
