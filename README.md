# unicorn-game

UNICORN is a startup-themed card game: build a company, raise money, hire talent, sabotage competitors, and be first to a $1B valuation.

This repository contains its responsive website, collectible card gallery, interactive attack/defense demo, and persistent playtest signup form.

## Run locally

Requires Node.js 22.13 or later.

```sh
npm run install:ci
npm run dev
```

Open the local URL printed by the development server.

## Build

```sh
npm run build
npm run start
```

The site uses React, Vinext, and a Cloudflare Worker. Playtest registrations are stored in a D1 database bound as `DB`. The schema and migration are included under `db/` and `drizzle/`.

To initialize the local signup database after building:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_glossy_dorian_gray.sql
```

Apply that initial migration once per local database. Hosted Sites deployments apply pending migrations automatically.

## Hosting

The private hosted website is available at:

https://unicorn-card-game.walkingthetalk1234.chatgpt.site

This repository holds the complete source. GitHub Pages alone cannot run the signup API or D1 database; deployment requires a compatible Worker runtime. The existing Sites project and storage binding are recorded in `.openai/hosting.json`.

## Prototype status

The website follows the supplied rules. Card effects that have not been defined are marked as in development, and all demo quotes are clearly labeled as placeholders. The demo illustrates an interaction rather than implementing a complete multiplayer game.
