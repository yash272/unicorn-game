# UNICORN

A startup card game for 3–5 players. Build a company, share Employees, betray a partner, and reach $1B valuation. About 45 minutes is a playtest target, not a measured duration.

## Edition 02

The current game tracks valuation only. There is no Cash, upkeep, shared market or separate round-event phase. Each player chooses a $50M Startup and receives 5 random cards. On each turn, draw 1 and play up to 2 cards. Immediately discard down to 7 whenever a draw or exchange exceeds the limit.

Play a card's effect or bank it face-up for its printed valuation. Banked cards cannot activate later. Attacks and defenses bank for $10M. Reactions come from the hand and do not use the two normal card plays. Only one player wins, at the end of their own completed turn.

Investor gives the opponent a face-up +$50M card in exchange for one random card from their hand. Joint Venture shares one Employee from each startup; both partners count both. Ditch gives both shared Employees to the attacker, preserving their valuation while reducing the partner's. Golden Handcuffs reverses Ditch: the defender keeps both instead.

The 100-card main deck includes 4 Ditch, 2 Founder Mixer and 2 Cease & Desist cards. Founder Mixer passes one hidden card per player to the left simultaneously. Cease & Desist returns a rival’s Growth card to their hand; Best Lawyers in Town can cancel it.

## Sources and outputs

- `game/cards.json` defines 41 designs and copy counts: 100 main-deck cards, 15 Startup cards, 5 References.
- `game/rules.json` provides the complete website and PDF rules; `game/RULES.md` is a readable companion.
- `game/demo.ts` drives nine scripted, mid-game interactive examples. This is not an online multiplayer game.
- `scripts/export-pdfs.py` uses ReportLab to generate the one-page concept sheet, full 120-card print set with rules, and 41 individual card fronts plus a universal back. Fonts are bundled in `public/fonts/`.
- Generated PDFs are copied to `public/downloads/` for the website and `../output/pdf/` for sharing.

Run `python3 scripts/export-pdfs.py` with ReportLab installed after editing the card catalog or rules. Print the full deck's pages 7–46 at Actual Size, landscape, short-edge duplex. Test the first front/back pair before printing everything.

## Local development

Use Node 22.13 or newer. Run `npm ci`, then `npm run dev`; the preview runs at http://localhost:5173. The Kickstarter playtest button is deliberately disabled until a campaign link is provided. The site collects no signup data and has no database-backed form.

Checks: `node --experimental-strip-types --test tests/gameplay.test.mjs`, `npx tsc --noEmit`, and `npm run lint`.

Sites hosting is configured by `.openai/hosting.json`. Build and publish using the installed Sites tooling while preserving the existing audience. GitHub origin remains `https://github.com/yash272/unicorn-game.git`.
