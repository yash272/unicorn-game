# UNICORN

A startup card game for 3–5 players. Build a company, share Employees, betray a partner, and reach $1B valuation. About 45 minutes is a playtest target, not a measured duration.

## Edition 03

The current game tracks valuation only. There is no Cash, upkeep, shared market or separate round-event phase. Each player chooses a $50M Startup and receives 5 random cards. On each turn, draw 1 and play up to 2 cards. Immediately discard down to 7 whenever a draw or exchange exceeds the limit.

Play a card's effect or bank it face-up for its printed valuation. Banked cards cannot activate later. Attacks and defenses bank for $10M. Reactions come from the hand and do not use the two normal card plays. Only one player wins, at the end of their own completed turn.

Investor gives the opponent a face-up +$50M card in exchange for one random card from their hand. Joint Venture shares one Employee from each startup; both partners count both. Ditch gives both shared Employees to the attacker, preserving their valuation while reducing the partner's. Golden Handcuffs reverses Ditch: the defender keeps both instead.

The 98-card main deck includes 4 Ditch and 2 Cease & Desist cards. Founder Scandal privately reveals a rival’s full hand and lets its player choose one card to steal. Cease & Desist returns a rival’s Growth card to their hand; Best Lawyers in Town can cancel it.

## Sources and outputs

- `game/cards.json` defines 40 designs and copy counts: 98 main-deck cards, 15 Startup cards, 5 References.
- `game/rules.json` provides the complete website and PDF rules; `game/RULES.md` is a readable companion.
- `game/demo.ts` drives eight scripted, mid-game interactive examples. The separate `/play` route runs the full online multiplayer game.
- `game/online.ts` enforces the printed rules for real 3–5 player rooms. The server stores room state in Cloudflare D1, returns only the requesting player's hidden hand, and rejects concurrent or stale moves.
- `public/cards/` contains direct PNG renders of the original individual-card PDF, including the universal back; the online trial displays these unchanged.
- `scripts/export-pdfs.py` uses ReportLab to generate the one-page concept sheet, full 118-card print set with rules, and 40 individual card fronts plus a universal back. Fonts are bundled in `public/fonts/`.
- Generated PDFs are copied to `public/downloads/` for the website and `../output/pdf/` for sharing.

Run `python3 scripts/export-pdfs.py` with ReportLab installed after editing the card catalog or rules. Print the full deck's pages 7–46 at Actual Size, landscape, short-edge duplex. Test the first front/back pair before printing everything.

## Local development

Use Node 22.13 or newer. Run `npm ci`, `npm run db:migrate:local`, then `npm run dev`; the preview runs at http://localhost:5173. The Kickstarter playtest button is deliberately disabled until a campaign link is provided. The site collects no signup data and has no database-backed form.

Checks: `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`. With a local preview running, `npm run test:multiplayer` tests five independent sessions through a complete game, including privacy, reconnection and concurrent moves.

## Play online

Click **Play online trial** on the website or open `/play`. Create a room, share the invitation link, and have friends join from their own devices. Once 3–5 players are seated, the host starts. Everyone receives five hidden cards and chooses one of three startups. Click a card to enlarge the original PDF design and choose one legal use. Targets and eligible partners explicitly defend or pass before an attack resolves. There are no bots or reaction countdowns.

Keep the room link and use the same browser to reconnect; an HTTP-only cookie identifies your seat. Hands remain separate even for partners. The host can start a rematch after someone wins. Inactive rooms expire after 14 days. Rooms from a previous rules edition must be replaced with a new room; saved states are not rewritten.

## Cloudflare / GitHub deployment

`wrangler.jsonc` names the existing `unicorn-game` Worker and its `DB` binding. This database stores multiplayer rooms only; the disabled Kickstarter button and removed signup form stay as they are.

The existing Cloudflare Workers Builds integration builds `main` after a GitHub push. Build command: `npm run build`. Recommended deploy command: `npm run deploy`, which applies the checked-in D1 migrations before uploading the Worker. The first room-table migration has been applied to the configured Cloudflare database. For a manual release, sign in with `npx wrangler login`, then run `npm run build` and `npm run deploy`.

For another Cloudflare account, create a D1 database, replace its ID in `wrangler.jsonc`, and apply the migration. The database ID is configuration, not a credential.

Sites hosting is configured by `.openai/hosting.json`. Build and publish using the installed Sites tooling while preserving the existing audience. GitHub origin remains `https://github.com/yash272/unicorn-game.git`.
