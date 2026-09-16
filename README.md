# unicorn-game

UNICORN is a startup-themed card game: build a company, raise money, hire talent, sabotage competitors, and be first to a $1B valuation.

This repository contains its responsive website, collectible card gallery, and interactive attack/defense demo.

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

The site uses React, Vinext, and a Cloudflare Worker. The playtest CTA is intentionally inactive while the Kickstarter campaign link is being prepared.

## Hosting

The private hosted website is available at:

https://unicorn-card-game.walkingthetalk1234.chatgpt.site

This repository holds the complete source. The existing Sites project is recorded in `.openai/hosting.json`.

## Prototype status

The website follows the supplied rules. Card effects that have not been defined are marked as in development, and all demo quotes are clearly labeled as placeholders. The demo illustrates an interaction rather than implementing a complete multiplayer game.
