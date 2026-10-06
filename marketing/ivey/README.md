# Ivey poster experiment

Find out which message brings Ivey students onto UNICORN's launch list. All three posters lead to the same website and email flow. Nothing is randomized or preferentially weighted.

| Poster | Message | Permanent QR destination | `utm_content` |
|---|---|---|---|
| A Build | Build a billion-dollar startup; betray your friends | https://www.unicornthegame.com/ivey-build | `build` |
| B CTO | You're worth $900M; your friend stole your CTO | https://www.unicornthegame.com/ivey-cto | `cto` |
| C Billion | Can you build a $1B startup? | https://www.unicornthegame.com/ivey-billion | `billion` |

## Run it in three steps

1. **Print and place.** Print one of each PDF at the same size, preferably A4 to start. Choose three approved, similarly visible noticeboard positions. Record their names below. Scan a paper proof before putting up the set; digital QR decoding cannot test your printer, lighting or distance.
2. **Rotate twice.** Leave the first arrangement for two days, then move the posters according to the table. After another two days, rotate once more. Each concept gets six days on display and two days in every position. Record removals or damage; make up lost exposure before comparing results.
3. **Read the report on day seven.** Run `npm run ivey:report` from the `unicorn-site` folder. It prints the comparison and saves a browser-readable HTML report plus CSV in `.exports/`. With equal exposure, the provisional winner is the poster that brings the most **new email addresses**. Use scans and rates to understand why. A one-signup difference in a tiny sample is not a reliable winner; repeat the rotation if results are close or sparse.

| Display period | Position 1 | Position 2 | Position 3 | Actual start/end and issues |
|---|---|---|---|---|
| Days 1-2 | A Build | B CTO | C Billion | |
| Days 3-4 | C Billion | A Build | B CTO | |
| Days 5-6 | B CTO | C Billion | A Build | |

Position 1: __________  Position 2: __________  Position 3: __________

Start date/time: __________  End date/time: __________

Keep the paper size, number of copies, position height and display time comparable. These routes identify a concept, not a particular physical copy or location. Avoid sharing the three URLs online during the test, since those visits would enter the same cohort. The printed root domain is a fallback; typing it without a campaign path cannot be attributed to a poster.

**Pre-test hypothesis:** B CTO will draw the most interest because it makes the betrayal concrete just before a potential win. This is a hypothesis only; all three variants use the same destination, QR dimensions, tracking logic and success flow. Because artwork also varies, the test selects a complete poster concept, not an isolated causal effect of headline wording.

## Read the results

From the repository folder, with your existing Cloudflare/Wrangler login:

```sh
npm run ivey:report
```

For a particular window:

```sh
npm run ivey:report -- --from=2026-10-07 --until=2026-10-14
```

Those dates are examples. Use your actual display dates. `from` includes midnight UTC; `until` excludes midnight UTC on that date. Omitting dates includes the campaign from its first recorded visit through now. The same window is applied to visits and conversions; later return visits outside the window do not enter that report.

| Variant | QR visits | Signup starts | New emails | Email conversion | KS clicks | KS CTR |
|---|---:|---:|---:|---:|---:|---:|
| A Build | Report | Report | Report | Report | Report | Report |
| B CTO | Report | Report | Report | Report | Report | Report |
| C Billion | Report | Report | Report | Report | Report | Report |

- **QR visits:** distinct poster-attributed browser visit IDs after the site loads. A reload within the same 30-minute visit counts once. A new tab, device or expired visit may count again. This is not a count of unique people, physical camera scans, impressions or actual poster exposure.
- **Signup starts:** visits that focus or submit an email field, counted once across all CTA positions. Focusing does not prove an email was entered.
- **New emails:** new addresses saved with that poster's source and matching visit. Existing subscribers are not counted again or reassigned to another poster. Case differences do not create duplicates.
- **Email conversion:** visits producing at least one new address divided by QR visits. The numerator is visits rather than addresses, so one device submitting two addresses cannot inflate the rate beyond 100%.
- **KS clicks / CTR:** visits with an outbound Kickstarter click, and those visits divided by QR visits. Multiple CTA clicks in one visit count once. These are clicks, not verified Kickstarter follows.

If copies or duration differ, compare new emails per poster-day and repeat with matched exposure. Email conversion alone is not the primary winner: a poster attracting one scan and one signup has a high rate but may acquire fewer people than a broadly appealing poster. The site cannot measure how many people walked past a poster.

## Files and print instructions

- `posters/`: three final A4 PDFs and 300-DPI PNG previews.
- `qr/`: three standalone SVGs and high-resolution PNGs (300-DPI metadata).
- `poster-preview.jpg`: side-by-side reference.
- `source/build-posters.py`: editable layout, typography, colors and QR generation.
- `source/scan-qr.m`: optional macOS QR decoding check.
- `campaign.json`: exact poster-to-URL mapping.

Print the PDF at **Actual Size on A4**, or enlarge to **A3 at 141.4%**. All PDF text, QR codes and the original CTO card are vector artwork with embedded fonts, so enlargement stays sharp. There is at least 10 mm of safe space for meaningful content; full-page backgrounds can leave a narrow white printer margin without clipping the design. No commercial bleed or crop marks are required for a noticeboard print. Use the same printer/paper/scale for all three.

Every QR is black on white, with an untouched four-module quiet zone and M error correction. Its full square is 98.8 mm on A4. Do not crop the white area, place logos inside the code, or put a glossy sleeve over just one variant. The QR destinations are clean URLs; UTMs are added by the website.

Rebuild the vector sources using Python with ReportLab and Pillow installed:

```sh
python3 marketing/ivey/source/build-posters.py
```

PNG previews are rendered from PDFs with `pdftoppm -r 300 -singlefile -png`. Fonts and the CTO renderer are reused from the project. No website assets or card rules are changed by this builder.

## Tracking implementation

Each App Router GET route issues a same-origin 307 redirect to the homepage with:

```text
utm_source=ivey_poster
utm_medium=offline
utm_campaign=ivey_launch
utm_content=build | cto | billion
```

The server ignores arbitrary query overrides and never redirects off-site. Redirects are not cached and are marked `noindex`. The clean paths should remain available after the test, since printed QR codes cannot be updated.

The existing first-party `/api/events` endpoint atomically stores a `poster_qr_visit` alongside a valid Ivey `landing_page_view`. It uses the existing deduplication index. Redirect-only requests and previews that never run the site JavaScript do not count. JavaScript blockers, network failures and some bots can still affect observed counts; this is a small acquisition experiment, not fraud-proof ad attribution.

Attribution stays in the existing 30-minute `sessionStorage` visit. Changing the campaign variant starts a fresh visit, while an untagged navigation within the same visit keeps its source. Kickstarter links carry the same UTM tags. No additional analytics vendor, advertising pixel, persistent person ID, cookie or browser secret was added.

### Events

New: `poster_qr_visit`.

Preserved: `landing_page_view`, `email_signup_started`, `email_signup_completed` (server-only after a new address is stored), `kickstarter_click`, `gameplay_video_play`, `scroll_50`, `scroll_90`, `cta_view`.

All poster events use the existing `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` fields for source/campaign/variant and retain `cta_location`. There is no duplicate generic `source=offline_poster` field; `ivey_poster` plus `offline` expresses that source using the established schema.

### Where emails are stored

The existing Cloudflare D1 database **`unicorn-game`**, binding **`DB`**, table **`launch_subscribers`** stores the private email record, consent and attribution. `utm_source=ivey_poster`, `utm_campaign=ivey_launch`, and `utm_content=build|cto|billion` identify poster acquisitions. `funnel_events` stores visit/conversion events without email addresses. No migration was needed.

Export actual subscribed contacts with:

```sh
npm run leads:export
```

The CSV includes the UTM columns. Filter `utm_campaign` to `ivey_launch` and group `utm_content` to inspect the poster list. Files are saved in the git-ignored `.exports/` folder with restricted file permissions. Never commit or publish them. Existing signup validation, consent copy, duplicate handling, rate limiting and suppression controls remain in place. Launch email sending is still done through your eventual mailing provider; this experiment does not automatically send emails.

## Repeat QA without contaminating the test

Use `/ivey-build?qa=1`, `/ivey-cto?qa=1`, or `/ivey-billion?qa=1`. Those follow the exact flow with `utm_campaign=qa-ivey_launch`, excluded from normal reports and subscriber exports.

1. In a private mobile browser window, open each QA URL. Confirm the homepage and email form are visible.
2. Submit a unique test address, check the inline success, then click Follow on Kickstarter. Confirm the address bar on Kickstarter still includes the variant. Repeating the same email must succeed without adding a new subscriber.
3. Run `npm run ivey:report -- --qa` to see only the test cohort. Use a fresh window for each variant. Do not use the real printed URLs for repeated QA.

Automated browser QA lives in `tests/ivey.browser.mjs` and uses optional Puppeteer Core plus Chrome; it is not a production dependency. Set `PUPPETEER_MODULE` to its installed JS entry, `BROWSER_PATH` if needed, and `IVEY_TEST_URL` to localhost or production. Production tests automatically use QA attribution and reserved `example.com` addresses. Screenshots and synthetic test evidence go into ignored `work/`.

Routine checks: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, plus `GAME_TEST_URL=http://127.0.0.1:8816 npm run test:multiplayer` against the built local Worker. Deployment continues through the existing main-branch Cloudflare Workers build.
