import catalog from "./cards.json" with { type: "json" };
export const definitions = catalog.cards;
export type Card = { id: string; key: string; attachments?: Card[] };
export type Command = {
  type: string;
  cardId?: string;
  targetId?: string;
  assetId?: string;
  key?: string;
};
export type Move = { label: string; command: Command };
type Player = {
  id: string;
  name: string;
  tokenHash: string;
  hand: Card[];
  bank: Card[];
  effects: Card[];
  startup?: string;
  choices: string[];
};
type Alliance = { card: Card; players: [string, string] };
type Attack = {
  kind: "attack";
  actor: string;
  target: string;
  card: Card;
  assetId?: string;
  responders: string[];
  passed: string[];
};
type Pending =
  | Attack
  | { kind: "offer"; attack: Attack }
  | {
      kind: "alliance";
      actor: string;
      target: string;
      cardId: string;
    }
  | { kind: "trade"; actor: string; target: string; cardId: string; returnCardId?: string }
  | { kind: "reveal"; actor: string; target: string; card: Card; cards: Card[] };
export type Room = {
  rulesEdition: string;
  phase: "lobby" | "setup" | "playing" | "finished";
  host: string;
  players: Player[];
  deck: Card[];
  discard: Card[];
  alliances: Alliance[];
  turn: number;
  step: "draw" | "act";
  plays: number;
  pending: Pending | null;
  winner?: string;
  log: string[];
  revision: number;
};
export const info = (c: Card | string) => {
  const d = definitions.find(
    (d) => d.key === (typeof c === "string" ? c : c.key),
  );
  if (!d) throw Error("Unknown card.");
  return d;
};
const player = (s: Room, id: string) => {
  const p = s.players.find((p) => p.id === id);
  if (!p) throw Error("Join this room first.");
  return p;
};
const note = (s: Room, t: string) => {
  s.log.push(t);
  s.log = s.log.slice(-60);
};
const random = (n: number) => {
  if (n <= 0) throw Error("Empty random choice.");
  const limit = Math.floor(4294967296 / n) * n;
  let x;
  do {
    x = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (x >= limit);
  return x % n;
};
const shuffle = <T>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export function createRoom(id: string, name: string, tokenHash: string): Room {
  return {
    rulesEdition: catalog.edition,
    phase: "lobby",
    host: id,
    players: [
      { id, name, tokenHash, hand: [], bank: [], effects: [], choices: [] },
    ],
    deck: [],
    discard: [],
    alliances: [],
    turn: 0,
    step: "draw",
    plays: 2,
    pending: null,
    log: [],
    revision: 0,
  };
}
export function joinRoom(s: Room, id: string, name: string, tokenHash: string) {
  if (s.phase !== "lobby" || s.players.length >= 5)
    throw Error("This room has started or is full.");
  if (s.players.some((p) => p.id === id)) throw Error("Already joined.");
  s.players.push({
    id,
    name,
    tokenHash,
    hand: [],
    bank: [],
    effects: [],
    choices: [],
  });
}
export function partner(s: Room, id: string) {
  return s.alliances.find(a => a.players.includes(id))?.players.find(p => p !== id);
}
function visibleAssets(s: Room, id: string) {
  return player(s, id).bank;
}
export function valuation(s: Room, id: string) {
  const p = player(s, id);
  return Math.max(
    0,
    (p.startup ? 50 : 0) +
      visibleAssets(s, id).reduce((n, c) => n + info(c).value, 0) -
      75 * p.effects.filter((c) => c.key === "pr-crisis").length,
  );
}
function draw(s: Room, p: Player, n: number) {
  for (let i = 0; i < n; i++) {
    if (!s.deck.length) s.deck = shuffle(s.discard.splice(0));
    const c = s.deck.pop();
    if (c) p.hand.push(c);
  }
}
function remove(a: Card[], id: string) {
  const i = a.findIndex((c) => c.id === id);
  if (i < 0) throw Error("That card is no longer available.");
  return a.splice(i, 1)[0];
}
function pickStartup(s: Room) {
  const p = s.players.find((p) => !p.startup);
  if (p) {
    const supply = definitions
      .filter((c) => c.role === "startup")
      .flatMap((c) =>
        Array.from(
          {
            length:
              c.copies - s.players.filter((p) => p.startup === c.key).length,
          },
          () => c.key,
        ),
      );
    p.choices = Array.from(new Set(shuffle(supply))).slice(0, 3);
  } else {
    s.phase = "playing";
    s.turn = random(s.players.length);
    s.step = "draw";
    note(s, `${s.players[s.turn].name} goes first.`);
  }
}
function start(s: Room) {
  s.deck = shuffle(
    definitions
      .filter((c) => !["startup", "reference"].includes(c.role))
      .flatMap((c) =>
        Array.from({ length: c.copies }, (_, i) => ({
          id: `${c.id}:${i + 1}`,
          key: c.key,
        })),
      ),
  );
  s.discard = [];
  s.alliances = [];
  s.pending = null;
  s.winner = undefined;
  s.phase = "setup";
  s.log = [];
  s.plays = 2;
  for (const p of s.players) {
    p.hand = [];
    p.bank = [];
    p.effects = [];
    p.startup = undefined;
    p.choices = [];
    draw(s, p, 5);
  }
  pickStartup(s);
  note(s, "Five cards dealt to each player. Choose your startups.");
}
function defense(s: Room, c: Card, a: Attack) {
  switch (c.key) {
    case "golden-handcuffs":
      return ["poach", "ditch"].includes(a.card.key);
    case "raise-salary":
      return (
        a.card.key === "poach" &&
        visibleAssets(s, a.target).some(
          (c) => c.id === a.assetId && info(c).category === "Employee",
        )
      );
    case "best-lawyers":
      return ["patent-lawsuit", "steal-customer", "cease-and-desist"].includes(
        a.card.key,
      );
    case "crisis-pr-team":
      return ["founder-scandal", "pr-crisis"].includes(a.card.key);
    case "not-for-sale":
      return a.card.key === "investor";
    default:
      return false;
  }
}
export function legalMoves(s: Room, id: string): Move[] {
  const p = player(s, id),
    moves: Move[] = [];
  const add = (
    label: string,
    type: string,
    extra: Omit<Command, "type"> = {},
  ) => moves.push({ label, command: { type, ...extra } });
  if (s.phase === "lobby") {
    if (id === s.host && s.players.length >= 3) add("Start game", "start");
    return moves;
  }
  if (s.phase === "finished") {
    if (id === s.host) add("Play again", "start");
    return moves;
  }
  if (s.phase === "setup") {
    for (const key of p.choices)
      add(`Choose ${info(key).name}`, "choose", { key });
    return moves;
  }
  const excess = s.players.filter((p) => p.hand.length > 7);
  if (excess.length) {
    if (p.hand.length > 7)
      for (const c of p.hand)
        add(`Discard ${info(c).name}`, "discard", { cardId: c.id });
    return moves;
  }
  const pending = s.pending;
  if (pending) {
    if (
      pending.kind === "attack" &&
      pending.responders.includes(id) &&
      !pending.passed.includes(id)
    ) {
      add("Pass on defending", "pass");
      for (const c of p.hand)
        if (defense(s, c, pending)) {
          if (pending.card.key === "ditch" && c.key === "golden-handcuffs" && player(s, pending.actor).bank.length) {
            for (const asset of player(s, pending.actor).bank)
              add(`Reverse Ditch: take ${info(asset).name}`, "react", {cardId: c.id, assetId: asset.id});
          } else add(`Defend with ${info(c).name}`, "react", { cardId: c.id });
        }
    }
    if (pending.kind === "offer" && pending.attack.actor === id) {
      add("Let Golden Handcuffs block it", "pass");
      for (const c of p.hand)
        if (c.key === "offer-they-cant-refuse")
          add("Play Offer They Can’t Refuse", "react", { cardId: c.id });
    }
    if (pending.kind === "alliance" && pending.target === id) {
      add("Decline alliance", "decline");
      add("Agree to Strategic Alliance", "accept");
    }
    if (pending.kind === "trade") {
      if (pending.actor === id) {
        add("Withdraw trade", "decline");
        if (pending.returnCardId) add("Agree and swap these two cards", "trade-accept");
      }
      if (pending.target === id) {
        add(pending.returnCardId ? "Withdraw trade" : "Decline trade", "decline");
        if (!pending.returnCardId) for (const card of p.hand) add(`Offer ${info(card).name} in return`, "trade-response", {cardId:card.id});
      }
    }
    if (pending.kind === "reveal" && pending.actor === id)
      for (const c of player(s, pending.target).hand)
        add(`Steal ${info(c).name}`, "steal", { cardId: c.id });
    return moves;
  }
  if (s.players[s.turn].id !== id) return moves;
  if (s.step === "draw") {
    add("Draw one card", "draw");
    return moves;
  }
  add("End my turn", "end");
  if (!s.plays) return moves;
  const others = s.players.filter((q) => q.id !== id),
    ally = partner(s, id);
  for (const c of p.hand) {
    const d = info(c);
    if (ally && player(s, ally).hand.length)
      add(`Offer ${d.name} in a hand trade with ${player(s, ally).name}`, "trade", {cardId:c.id, targetId:ally});
    add(
      d.role === "asset"
        ? `Add ${d.name} (+$${d.value}M)`
        : `Bank ${d.name} (+$${d.value}M)`,
      "bank",
      { cardId: c.id },
    );
    const effect = (label: string, extra: Omit<Command, "type"> = {}) =>
      add(label, "effect", { cardId: c.id, ...extra });
    switch (c.key) {
      case "investor-backchannel":
        effect("Draw two cards");
        break;
      case "strategic-alliance":
        if (!ally)
          for (const q of others.filter(q => !partner(s, q.id)))
            effect(`Invite ${q.name} to Strategic Alliance`, {targetId:q.id});
        break;
      case "ditch":
        if (ally)
          for (const asset of player(s, ally).bank)
            effect(`Ditch ${player(s, ally).name}: take ${info(asset).name}`, {targetId:ally, assetId:asset.id});
        break;
      case "non-compete":
        for (const own of visibleAssets(s, id).filter(
          (c) => info(c).category === "Employee",
        ))
          effect(`Protect your ${info(own).name}`, { assetId: own.id });
        break;
      case "best-lawyers":
      case "crisis-pr-team":
        for (const q of s.players.filter((q) => q.id === id || q.id === ally))
          for (const e of q.effects.filter(
            (e) =>
              e.key ===
              (c.key === "best-lawyers" ? "patent-lawsuit" : "pr-crisis"),
          ))
            effect(`Remove ${info(e).name} from ${q.name}`, {
              targetId: q.id,
              assetId: e.id,
            });
        break;
      case "poach":
      case "steal-customer":
      case "cease-and-desist":
        for (const q of others)
          for (const a of visibleAssets(s, q.id)) {
            if (c.key === "steal-customer" && info(a).tag !== "Contract")
              continue;
            if (c.key === "cease-and-desist" && info(a).category !== "Growth")
              continue;
            effect(
              `${c.key === "cease-and-desist" ? "Return" : "Take"} ${q.name}’s ${info(a).name}`,
              { targetId: q.id, assetId: a.id },
            );
          }
        break;
      case "patent-lawsuit":
      case "pr-crisis":
      case "founder-scandal":
      case "investor":
        for (const q of others) {
          if (["investor", "founder-scandal"].includes(c.key) && !q.hand.length) continue;
          if (
            c.key === "patent-lawsuit" &&
            q.effects.some((c) => c.key === "patent-lawsuit")
          )
            continue;
          effect(`Use ${d.name} on ${q.name}`, { targetId: q.id });
        }
        break;
    }
  }
  return moves;
}
function closeAlliance(s: Room, id: string) {
  const a=s.alliances.find(a => a.players.includes(id));
  if (!a) throw Error("The alliance is no longer active.");
  s.discard.push(a.card);
  s.alliances.splice(s.alliances.indexOf(a),1);
}
function takeAsset(s: Room, target: string, assetId: string) {
  return remove(player(s,target).bank,assetId);
}
function resolve(s: Room, a: Attack) {
  const target = player(s, a.target),
    actor = player(s, a.actor);
  s.pending = null;
  let keep = false;
  switch (a.card.key) {
    case "poach":
    case "steal-customer":
      actor.bank.push(takeAsset(s, a.target, a.assetId!));
      break;
    case "cease-and-desist":
      target.hand.push(remove(target.bank, a.assetId!));
      break;
    case "investor":
      target.bank.push(a.card);
      actor.hand.push(target.hand.splice(random(target.hand.length), 1)[0]);
      keep = true;
      break;
    case "patent-lawsuit":
    case "pr-crisis":
      target.effects.push(a.card);
      keep = true;
      break;
    case "founder-scandal":
      s.pending = {
        kind: "reveal",
        actor: actor.id,
        target: target.id,
        card: a.card,
        cards: structuredClone(target.hand),
      };
      keep = true;
      break;
    case "ditch":
      actor.bank.push(takeAsset(s, target.id, a.assetId!));
      closeAlliance(s, actor.id);
      break;
  }
  if (!keep) s.discard.push(a.card);
  note(s, `${info(a.card).name} resolves against ${target.name}.`);
}
export function apply(s: Room, id: string, c: Command) {
  const same = (a: Command, b: Command) =>
    ["type", "cardId", "targetId", "assetId", "key"].every(
      (k) => a[k as keyof Command] === b[k as keyof Command],
    );
  if (!legalMoves(s, id).some((m) => same(m.command, c)))
    throw Error(
      "That move is unavailable. Refresh the table and choose a legal move.",
    );
  const p = player(s, id);
  switch (c.type) {
    case "start":
      start(s);
      break;
    case "choose":
      p.startup = c.key;
      p.choices = [];
      pickStartup(s);
      break;
    case "discard":
      s.discard.push(remove(p.hand, c.cardId!));
      note(s, `${p.name} discards down toward seven cards.`);
      break;
    case "draw":
      draw(s, p, 1);
      s.step = "act";
      note(s, `${p.name} draws a card.`);
      break;
    case "bank": {
      const card = remove(p.hand, c.cardId!);
      p.bank.push(card);
      s.plays--;
      note(s, `${p.name} adds ${info(card).name} for +$${info(card).value}M.`);
      break;
    }
    case "end":
      if (valuation(s, id) >= 1000) {
        s.phase = "finished";
        s.winner = id;
        note(s, `${p.name} becomes the Unicorn!`);
      } else {
        do {
          s.turn = (s.turn + 1) % s.players.length;
          const q = s.players[s.turn];
          const lawsuit = q.effects.find((c) => c.key === "patent-lawsuit");
          if (!lawsuit) break;
          s.discard.push(remove(q.effects, lawsuit.id));
          note(s, `${q.name} skips this turn due to Patent Lawsuit.`);
        } while (true);
        s.step = "draw";
        s.plays = 2;
        note(s, `${s.players[s.turn].name}’s turn.`);
      }
      break;
    case "steal": {
      const reveal = s.pending as Extract<Pending, { kind: "reveal" }>;
      p.hand.push(remove(player(s, reveal.target).hand, c.cardId!));
      s.discard.push(reveal.card);
      s.pending = null;
      note(s, `${p.name} steals one chosen hand card with Founder Scandal.`);
      break;
    }
    case "decline":
      note(s, `${p.name} declines the ${s.pending?.kind === "trade" ? "trade" : "alliance"}. No card play is spent.`);
      s.pending = null;
      break;
    case "accept": {
      const invitation=s.pending as Extract<Pending,{kind:"alliance"}>;
      const actor=player(s,invitation.actor);
      s.alliances.push({card:remove(actor.hand,invitation.cardId),players:[actor.id,id]});
      s.plays--;
      s.pending=null;
      note(s,`${actor.name} and ${p.name} form a Strategic Alliance. Valuations stay separate.`);
      break;
    }
    case "trade":
      s.pending={kind:"trade",actor:id,target:c.targetId!,cardId:c.cardId!};
      note(s,`${p.name} offers a private hand trade to ${player(s,c.targetId!).name}.`);
      break;
    case "trade-response":
      (s.pending as Extract<Pending,{kind:"trade"}>).returnCardId=c.cardId!;
      note(s,`${p.name} offers a card in return. Both cards stay in hand until agreement.`);
      break;
    case "trade-accept": {
      const trade=s.pending as Extract<Pending,{kind:"trade"}>;
      const target=player(s,trade.target);
      const offered=remove(p.hand,trade.cardId),returned=remove(target.hand,trade.returnCardId!);
      p.hand.push(returned);target.hand.push(offered);
      s.plays--;s.pending=null;
      note(s,`${p.name} and ${target.name} swap one hand card each. Valuations stay unchanged.`);
      break;
    }
    case "pass":
      if (s.pending?.kind === "offer") {
        s.discard.push(s.pending.attack.card);
        s.pending = null;
        note(s, "Golden Handcuffs blocks the Poach.");
      } else {
        const a = s.pending as Attack;
        a.passed.push(id);
        if (a.responders.every((id) => a.passed.includes(id))) resolve(s, a);
      }
      break;
    case "react": {
      const card = remove(p.hand, c.cardId!);
      s.discard.push(card);
      if (s.pending?.kind === "offer") {
        resolve(s, s.pending.attack);
        break;
      }
      const a = s.pending as Attack;
      note(s, `${p.name} reacts with ${info(card).name}.`);
      if (card.key === "golden-handcuffs" && a.card.key === "poach") {
        s.pending = { kind: "offer", attack: a };
        break;
      }
      if (a.card.key === "ditch") {
        if (c.assetId) p.bank.push(takeAsset(s,a.actor,c.assetId));
        closeAlliance(s,a.actor);
        note(s, `${p.name} reverses Ditch${c.assetId ? " and takes one banked card" : ""}. The alliance ends.`);
      }
      s.discard.push(a.card);
      s.pending = null;
      break;
    }
    case "effect": {
      const handCard = p.hand.find((x) => x.id === c.cardId)!;
      if (handCard.key === "strategic-alliance") {
        s.pending = {
          kind: "alliance",
          actor: id,
          target: c.targetId!,
          cardId: handCard.id,
        };
        note(
          s,
          `${p.name} invites ${player(s, c.targetId!).name} to a Strategic Alliance.`,
        );
        break;
      }
      const card = remove(p.hand, c.cardId!);
      s.plays--;
      if (card.key === "investor-backchannel") {
        draw(s, p, 2);
        s.discard.push(card);
        note(s, `${p.name} uses Investor Backchannel to draw two.`);
        break;
      }
      if (card.key === "non-compete") {
        const employee = visibleAssets(s, id).find((x) => x.id === c.assetId)!;
        (employee.attachments ??= []).push(card);
        note(s, `${p.name} protects ${info(employee).name}.`);
        break;
      }
      if (card.key === "best-lawyers" || card.key === "crisis-pr-team") {
        s.discard.push(
          remove(player(s, c.targetId!).effects, c.assetId!),
          card,
        );
        note(
          s,
          `${p.name} removes an active ${card.key === "best-lawyers" ? "Lawsuit" : "PR Crisis"}.`,
        );
        break;
      }
      const ally = partner(s, c.targetId!);
      const a: Attack = {
        kind: "attack",
        actor: id,
        target: c.targetId!,
        card,
        assetId: c.assetId,
        responders: [
          c.targetId!,
          ...(ally && ally !== id && card.key !== "ditch" ? [ally] : []),
        ],
        passed: [],
      };
      if (card.key === "poach") {
        const asset = visibleAssets(s, a.target).find(
          (x) => x.id === a.assetId,
        )!;
        if (asset.attachments?.length) {
          s.discard.push(asset.attachments.shift()!, card);
          note(s, "Non-Compete automatically cancels Poach.");
          break;
        }
      }
      s.pending = a;
      note(
        s,
        `${p.name} plays ${info(card).name} against ${player(s, a.target).name}.`,
      );
      break;
    }
  }
  s.revision++;
  return s;
}
export function allCards(s: Room): Card[] {
  const cards = [
    ...s.deck,
    ...s.discard,
    ...s.players.flatMap((p) => [...p.hand, ...p.bank, ...p.effects]),
    ...s.alliances.map(a => a.card),
  ];
  if (s.pending?.kind === "attack" || s.pending?.kind === "reveal")
    cards.push(s.pending.card);
  if (s.pending?.kind === "offer") cards.push(s.pending.attack.card);
  return cards.flatMap((c) => [c, ...(c.attachments ?? [])]);
}
export function view(s: Room, id: string) {
  const p = player(s, id),
    pending = s.pending;
  let publicPending: Record<string, unknown> | null = null;
  if (pending?.kind === "attack")
    publicPending = {
      kind: pending.kind,
      actor: pending.actor,
      target: pending.target,
      card: pending.card,
      assetId: pending.assetId,
      waiting: pending.responders.filter((id) => !pending.passed.includes(id)),
    };
  if (pending?.kind === "offer")
    publicPending = {
      kind: "offer",
      actor: pending.attack.actor,
      target: pending.attack.target,
      card: pending.attack.card,
      waiting: [pending.attack.actor],
    };
  if (pending?.kind === "alliance")
    publicPending = {
      kind: "alliance",
      actor: pending.actor,
      target: pending.target,
      waiting: [pending.target],
    };
  if (pending?.kind === "trade")
    publicPending={kind:"trade",actor:pending.actor,target:pending.target,waiting:[pending.returnCardId ? pending.actor : pending.target]};
  if (pending?.kind === "reveal")
    publicPending = {
      kind: "reveal",
      actor: pending.actor,
      target: pending.target,
      waiting: [pending.actor],
    };
  return {
    revision: s.revision,
    phase: s.phase,
    host: s.host,
    you: id,
    turn: s.players[s.turn]?.id,
    step: s.step,
    plays: s.plays,
    winner: s.winner,
    players: s.players.map((q) => ({
      id: q.id,
      name: q.name,
      startup: q.startup,
      handCount: q.hand.length,
      bank: q.bank,
      effects: q.effects,
      valuation: valuation(s, q.id),
      partner: partner(s, q.id),
    })),
    hand: p.hand,
    choices: p.choices,
    deckCount: s.deck.length,
    discard: s.discard,
    alliances: s.alliances,
    trade: pending?.kind === "trade" && [pending.actor,pending.target].includes(id)
      ? {actor:pending.actor,target:pending.target,offered:player(s,pending.actor).hand.find(c=>c.id===pending.cardId)!,returned:player(s,pending.target).hand.find(c=>c.id===pending.returnCardId)}
      : undefined,
    pending: publicPending,
    reveal:
      pending?.kind === "reveal" && pending.actor === id
        ? pending.cards
        : undefined,
    moves: legalMoves(s, id),
    overflow: s.players
      .filter((p) => p.hand.length > 7)
      .map((p) => ({ id: p.id, count: p.hand.length - 7 })),
    log: s.log,
  };
}
