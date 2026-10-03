import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoom,
  joinRoom,
  apply,
  legalMoves,
  view,
  valuation,
  allCards,
  definitions,
} from "../game/online.ts";
const cmd = (s, id, type, extra = {}) => apply(s, id, { type, ...extra });
function ready(n = 3) {
  let s = createRoom("a", "Alice", "hash-a");
  for (let i = 1; i < n; i++)
    joinRoom(s, String.fromCharCode(97 + i), "Player " + i, "hash-" + i);
  cmd(s, "a", "start");
  while (s.phase === "setup") {
    const p = s.players.find((p) => !p.startup);
    cmd(s, p.id, "choose", { key: p.choices[0] });
  }
  return s;
}
function give(s, id, key, zone = "hand") {
  // A shuffled deal may already contain every copy of this tactic.
  const existing = zone === "hand" && s.players.find(p => p.id === id).hand.find(c => c.key === key);
  if (existing) return existing;
  for (const p of s.players) {
    for (const z of ["hand", "bank", "effects"]) {
      if (p.id === id && z === zone) continue;
      const i = p[z].findIndex((c) => c.key === key);
      if (i >= 0) {
        const [c] = p[z].splice(i, 1);
        s.players.find((p) => p.id === id)[zone].push(c);
        return c;
      }
    }
  }
  const i = s.deck.findIndex((c) => c.key === key);
  assert.ok(i >= 0, key);
  const [c] = s.deck.splice(i, 1);
  s.players.find((p) => p.id === id)[zone].push(c);
  return c;
}
function active(s, id = "a") {
  s.turn = s.players.findIndex((p) => p.id === id);
  s.step = "act";
  s.plays = 2;
  for (const p of s.players)
    while (p.hand.length > 5) s.deck.push(p.hand.pop());
}
function reactPass(s) {
  while (s.pending?.kind === "attack") {
    const p = s.pending.responders.find((id) => !s.pending.passed.includes(id));
    cmd(s, p, "pass");
  }
}
function alliance(s) {
  active(s);
  const card = give(s, "a", "strategic-alliance");
  cmd(s, "a", "effect", {cardId: card.id, targetId: "b"});
  cmd(s, "b", "accept");
  return s;
}
test("exact 98-card inventory and private shuffled deck; 3–5 player setup", () => {
  for (const n of [3, 4, 5]) {
    const s = ready(n);
    assert.equal(allCards(s).length, 98);
    assert.equal(new Set(allCards(s).map((c) => c.id)).size, 98);
    assert.equal(s.players[0].hand.length, 5);
    assert.equal(valuation(s, "a"), 50);
    const v = view(s, "a");
    assert.equal(v.players[1].hand, undefined);
    assert.equal(v.deck, undefined);
    assert.equal(v.players[0].tokenHash, undefined);
    assert.equal(v.hand.length, 5);
    assert.equal(
      definitions
        .filter((c) => c.role === "startup")
        .reduce((n, c) => n + c.copies, 0),
      15,
    );
  }
});
test("turn and hand limits enforced, banked attacks never activate", () => {
  const s = ready();
  active(s);
  const c = give(s, "a", "pr-crisis");
  cmd(s, "a", "bank", { cardId: c.id });
  assert.equal(valuation(s, "a"), 60);
  assert.equal(s.players[1].effects.length, 0);
  assert.throws(() => cmd(s, "b", "end"));
  s.plays = 0;
  assert.throws(() => cmd(s, "a", "bank", { cardId: s.players[0].hand[0].id }));
});
test("alliance formation needs consent, keeps separate valuations and requires no Employees", () => {
  const s=ready();active(s);
  const card=give(s,"a","strategic-alliance");
  cmd(s,"a","effect",{cardId:card.id,targetId:"b"});
  assert.equal(s.plays,2);assert.equal(s.alliances.length,0);
  assert.throws(()=>cmd(s,"c","accept"));
  cmd(s,"b","decline");assert.equal(s.plays,2);
  assert.ok(s.players[0].hand.some(c=>c.id===card.id));
  cmd(s,"a","effect",{cardId:card.id,targetId:"b"});cmd(s,"b","accept");
  assert.equal(s.plays,1);assert.equal(s.alliances.length,1);
  assert.equal(valuation(s,"a"),50);assert.equal(valuation(s,"b"),50);
  assert.equal(view(s,"a").players[1].partner,"a");
  assert.equal(allCards(s).length,98);
  const another=give(s,"c","strategic-alliance");active(s,"c");
  assert.ok(!legalMoves(s,"c").some(m=>m.command.type==='effect'&&m.command.cardId===another.id));
});
test("allied hand trades stay private and swap only after both players agree", () => {
  const s=alliance(ready());active(s);
  const offered=s.players[0].hand[0], returned=s.players[1].hand[1];
  const aBefore=structuredClone(s.players[0].hand),bBefore=structuredClone(s.players[1].hand);
  cmd(s,"a","trade",{cardId:offered.id,targetId:"b"});
  assert.deepEqual(s.players[0].hand,aBefore);assert.equal(s.plays,2);
  assert.equal(view(s,"b").trade.offered.id,offered.id);
  assert.equal(view(s,"c").trade,undefined);
  assert.equal(view(s,"c").pending.cardId,undefined);
  assert.ok(!JSON.stringify(view(s,"c").pending).includes(offered.id));
  assert.throws(()=>cmd(s,"c","trade-response",{cardId:s.players[2].hand[0].id}));
  assert.throws(()=>cmd(s,"a","trade-accept"));
  cmd(s,"b","trade-response",{cardId:returned.id});
  assert.deepEqual(s.players[1].hand,bBefore);
  assert.equal(view(s,"a").trade.returned.id,returned.id);
  assert.throws(()=>cmd(s,"b","trade-accept"));
  cmd(s,"a","trade-accept");
  assert.deepEqual(s.players[0].hand,[...aBefore.filter(c=>c.id!==offered.id),returned]);
  assert.deepEqual(s.players[1].hand,[...bBefore.filter(c=>c.id!==returned.id),offered]);
  assert.equal(s.plays,1);assert.equal(s.pending,null);
  assert.equal(s.players[0].hand.length,aBefore.length);assert.equal(s.players[1].hand.length,bBefore.length);
  assert.equal(valuation(s,"a"),50);assert.equal(valuation(s,"b"),50);
  assert.equal(allCards(s).length,98);
  assert.throws(()=>cmd(s,"a","trade-accept"));
});
test("declined trades spend no play and cannot be offered off-turn, outside an alliance or to an empty hand", () => {
  const s=alliance(ready());active(s);
  const card=s.players[0].hand[0];
  assert.throws(()=>cmd(s,"b","trade",{cardId:s.players[1].hand[0].id,targetId:"a"}));
  assert.throws(()=>cmd(s,"a","trade",{cardId:card.id,targetId:"c"}));
  cmd(s,"a","trade",{cardId:card.id,targetId:"b"});cmd(s,"b","decline");
  assert.equal(s.plays,2);assert.ok(s.players[0].hand.some(c=>c.id===card.id));
  cmd(s,"a","trade",{cardId:card.id,targetId:"b"});
  cmd(s,"b","trade-response",{cardId:s.players[1].hand[0].id});cmd(s,"a","decline");
  assert.equal(s.plays,2);assert.ok(s.players[0].hand.some(c=>c.id===card.id));
  cmd(s,"a","trade",{cardId:card.id,targetId:"b"});
  cmd(s,"b","trade-response",{cardId:s.players[1].hand[0].id});cmd(s,"b","decline");
  assert.equal(s.plays,2);assert.ok(s.players[0].hand.some(c=>c.id===card.id));
  s.deck.push(...s.players[1].hand.splice(0));
  assert.ok(!legalMoves(s,"a").some(m=>m.command.type==='trade'));
  s.plays=0;assert.ok(!legalMoves(s,"a").some(m=>m.command.type==='trade'));
});
test("Ditch steals the chosen banked card; Handcuffs lets the defender choose the reverse theft", () => {
  for(const blocked of [false,true]) {
    const s=alliance(ready());active(s);
    const scientist=give(s,"a","chief-scientist","bank");
    const cto=give(s,"b","rockstar-cto","bank");
    const ditch=give(s,"a","ditch");
    const gh=blocked?give(s,"b","golden-handcuffs"):null;
    assert.equal(valuation(s,"a"),175);assert.equal(valuation(s,"b"),150);
    cmd(s,"a","effect",{cardId:ditch.id,targetId:"b",assetId:cto.id});
    if(gh) {
      assert.throws(()=>cmd(s,"b","react",{cardId:gh.id}));
      cmd(s,"b","react",{cardId:gh.id,assetId:scientist.id});
    } else reactPass(s);
    assert.equal(valuation(s,"a"),blocked?50:275);
    assert.equal(valuation(s,"b"),blocked?275:50);
    assert.equal(s.alliances.length,0);assert.equal(allCards(s).length,98);
    assert.equal(s.players[blocked?1:0].bank.length,2);
  }
});
test("Handcuffs still cancels Ditch when the attacker has no banked card; Ditch needs a partner asset",()=>{
  const s=alliance(ready());active(s);
  const ditch=give(s,"a","ditch");
  assert.ok(!legalMoves(s,"a").some(m=>m.command.type==='effect'&&m.command.cardId===ditch.id));
  const asset=give(s,"b","elite-engineer","bank"),gh=give(s,"b","golden-handcuffs");
  cmd(s,"a","effect",{cardId:ditch.id,targetId:"b",assetId:asset.id});
  cmd(s,"b","react",{cardId:gh.id});
  assert.equal(valuation(s,"a"),50);assert.equal(valuation(s,"b"),125);
  assert.equal(s.alliances.length,0);assert.equal(s.pending,null);assert.equal(allCards(s).length,98);
});
test("Poach + Handcuffs + Offer resolves exactly once", () => {
  const s = ready();
  active(s);
  const asset = give(s, "b", "chief-scientist", "bank");
  const poach = give(s, "a", "poach");
  const gh = give(s, "b", "golden-handcuffs");
  const offer = give(s, "a", "offer-they-cant-refuse");
  cmd(s, "a", "effect", { cardId: poach.id, targetId: "b", assetId: asset.id });
  cmd(s, "b", "react", { cardId: gh.id });
  assert.equal(s.pending.kind, "offer");
  cmd(s, "a", "react", { cardId: offer.id });
  assert.equal(s.players[0].bank[0].id, asset.id);
  assert.equal(s.pending, null);
  assert.equal(allCards(s).length, 98);
});
test("Founder Scandal privately reveals the whole hand and steals the actor's chosen card", () => {
  const s = ready(); active(s);
  const scandal = give(s, "a", "founder-scandal");
  const before = structuredClone(s.players[1].hand);
  const chosen = before.at(-1);
  const actorCount = s.players[0].hand.length;
  cmd(s, "a", "effect", {cardId: scandal.id, targetId: "b"}); reactPass(s);
  assert.deepEqual(view(s, "a").reveal, before);
  for (const id of ["b", "c"]) {
    assert.equal(view(s, id).reveal, undefined);
    assert.equal(view(s, id).pending.cards, undefined);
    assert.ok(!view(s, id).moves.some(m => m.command.type === "steal"));
  }
  assert.equal(allCards(s).length, 98);
  assert.throws(() => cmd(s, "b", "steal", {cardId: chosen.id}));
  assert.throws(() => cmd(s, "a", "steal", {cardId: scandal.id}));
  assert.throws(() => cmd(s, "a", "ack"));
  cmd(s, "a", "steal", {cardId: chosen.id});
  assert.ok(s.players[0].hand.some(c => c.id === chosen.id));
  assert.deepEqual(s.players[1].hand, before.slice(0, -1));
  assert.equal(s.players[0].hand.length, actorCount);
  assert.equal(s.pending, null);
  assert.equal(view(s, "a").reveal, undefined);
  assert.ok(s.discard.some(c => c.id === scandal.id));
  assert.equal(s.plays, 1);
  assert.equal(valuation(s, "a"), 50);
  assert.equal(valuation(s, "b"), 50);
  assert.equal(allCards(s).length, 98);
  assert.throws(() => cmd(s, "a", "steal", {cardId: chosen.id}));
});
test("Founder Scandal cannot target an empty hand or reveal through Crisis PR Team", () => {
  const s = ready(); active(s);
  const scandal = give(s, "a", "founder-scandal");
  s.deck.push(...s.players[1].hand.splice(0));
  assert.ok(!legalMoves(s, "a").some(m => m.command.type === "effect" && m.command.cardId === scandal.id && m.command.targetId === "b"));
  const defense = give(s, "b", "crisis-pr-team");
  const before = structuredClone(s.players[1].hand);
  cmd(s, "a", "effect", {cardId: scandal.id, targetId: "b"});
  cmd(s, "b", "react", {cardId: defense.id});
  assert.equal(s.pending, null);
  assert.equal(view(s, "a").reveal, undefined);
  assert.deepEqual(s.players[1].hand, before.filter(c => c.id !== defense.id));
  assert.equal(allCards(s).length, 98);
});
test("Investor still transfers exactly one random card and adds $50M to its target", () => {
  const s = ready(); active(s);
  const inv = give(s, "a", "investor");
  const before = structuredClone(s.players[1].hand);
  cmd(s, "a", "effect", {cardId: inv.id, targetId: "b"}); reactPass(s);
  assert.equal(s.players[1].hand.length, before.length - 1);
  assert.ok(before.some(c => s.players[0].hand.some(h => h.id === c.id)));
  assert.ok(s.players[1].bank.some(c => c.id === inv.id));
  assert.equal(valuation(s, "b"), 100);
  assert.equal(allCards(s).length, 98);
});
test("a lawsuit skips a whole turn, and victory checks only at turn end", () => {
  const s = ready();
  active(s);
  give(s, "b", "patent-lawsuit", "effects");
  cmd(s, "a", "end");
  assert.equal(s.players[s.turn].id, "c");
  assert.equal(s.players[1].effects.length, 0);
  active(s);
  for (let i = 0; i < 9; i++)
    give(s, "a", i < 4 ? "chief-scientist" : i < 7 ? "viral-launch" : "rockstar-cto", "bank");
  assert.ok(valuation(s, "a") >= 1000);
  assert.equal(s.phase, "playing");
  cmd(s, "a", "end");
  assert.equal(s.winner, "a");
});
test("random legal games conserve all 98 cards and never expose opponents hands", () => {
  for (let game = 0; game < 8; game++) {
    const s = ready(3 + (game % 3));
    for (let t = 0; t < 500 && s.phase !== "finished"; t++) {
      const options = s.players.flatMap((p) =>
        legalMoves(s, p.id).map((m) => ({ p: p.id, c: m.command })),
      );
      assert.ok(options.length, "game must have a legal next move");
      const move = options[Math.floor(Math.random() * options.length)];
      apply(s, move.p, move.c);
      const cards = allCards(s);
      assert.equal(cards.length, 98);
      assert.equal(new Set(cards.map((c) => c.id)).size, 98);
      for (const p of s.players)
        assert.ok(
          !view(s, p.id).players.some((q) => "hand" in q || "tokenHash" in q),
        );
    }
  }
});
test("startup offers reflect remaining physical copies, with no duplicate types", () => {
  const original = crypto.getRandomValues.bind(crypto);
  let seed = 987654321;
  crypto.getRandomValues = (array) => {
    for (let i = 0; i < array.length; i++) {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      array[i] = (t ^ (t >>> 14)) >>> 0;
    }
    return array;
  };
  try {
    let available = 0,
      included = 0;
    for (let i = 0; i < 2500; i++) {
      const s = createRoom("a", "Alice", "a");
      joinRoom(s, "b", "Bob", "b");
      joinRoom(s, "c", "Carol", "c");
      cmd(s, "a", "start");
      if (!s.players[0].choices.includes("neural-ai")) continue;
      cmd(s, "a", "choose", { key: "neural-ai" });
      const offer = s.players[1].choices;
      assert.equal(new Set(offer).size, 3);
      available++;
      if (offer.includes("neural-ai")) included++;
    }
    assert.ok(available > 500);
    assert.ok(
      included / available > 0.43 && included / available < 0.53,
      `Remaining-copy inclusion rate: ${included / available}`,
    );
  } finally {
    crypto.getRandomValues = original;
  }
});
test("Cease & Desist returns Growth and pauses everyone for an off-turn hand-limit discard", () => {
  const s = ready();
  active(s);
  const growth = give(s, "b", "viral-launch", "bank"),
    cease = give(s, "a", "cease-and-desist");
  while (s.players[1].hand.length < 7) s.players[1].hand.push(s.deck.pop());
  cmd(s, "a", "effect", {
    cardId: cease.id,
    targetId: "b",
    assetId: growth.id,
  });
  reactPass(s);
  assert.equal(s.players[1].hand.length, 8);
  assert.equal(valuation(s, "b"), 50);
  assert.equal(legalMoves(s, "a").length, 0);
  assert.ok(legalMoves(s, "b").every((m) => m.command.type === "discard"));
  cmd(s, "b", "discard", { cardId: growth.id });
  assert.ok(legalMoves(s, "a").some((m) => m.command.type === "end"));
  assert.equal(allCards(s).length, 98);
});
test("every printed reaction blocks its eligible attack without banking either card", () => {
  for (const [attack, defender, assetKey] of [
    ["poach", "raise-salary", "chief-scientist"],
    ["investor", "not-for-sale"],
    ["founder-scandal", "crisis-pr-team"],
    ["pr-crisis", "crisis-pr-team"],
    ["patent-lawsuit", "best-lawyers"],
    ["steal-customer", "best-lawyers", "fortune-500-contract"],
    ["cease-and-desist", "best-lawyers", "viral-launch"],
  ]) {
    const s = ready();
    active(s);
    const asset = assetKey ? give(s, "b", assetKey, "bank") : null;
    const a = give(s, "a", attack),
      d = give(s, "b", defender);
    const value = valuation(s, "b"),
      hand = s.players[1].hand.length;
    cmd(s, "a", "effect", {
      cardId: a.id,
      targetId: "b",
      ...(asset ? { assetId: asset.id } : {}),
    });
    cmd(s, "b", "react", { cardId: d.id });
    assert.equal(s.pending, null);
    assert.equal(valuation(s, "b"), value);
    assert.equal(s.players[1].hand.length, hand - 1);
    assert.equal(s.players[1].effects.length, 0);
    assert.equal(allCards(s).length, 98);
  }
});
test("Non-Compete blocks Poach once, and taking an ally's Employee does not end the alliance", () => {
  const s=alliance(ready());active(s);
  const employee=give(s,"a","chief-scientist","bank"),nc=give(s,"a","non-compete");
  cmd(s,"a","effect",{cardId:nc.id,assetId:employee.id});
  active(s,"c");
  const poach=give(s,"c","poach");
  cmd(s,"c","effect",{cardId:poach.id,targetId:"a",assetId:employee.id});
  assert.equal(s.pending,null);assert.equal(employee.attachments.length,0);
  assert.equal(s.alliances.length,1);
  const second=give(s,"c","poach");
  cmd(s,"c","effect",{cardId:second.id,targetId:"a",assetId:employee.id});reactPass(s);
  assert.equal(s.alliances.length,1);assert.equal(valuation(s,"a"),50);
  assert.equal(valuation(s,"b"),50);assert.equal(valuation(s,"c"),175);
  assert.equal(allCards(s).length,98);
});
test("allies may defend or remove penalties, but an attacker cannot defend against their own attack", () => {
  const s=alliance(ready());give(s,"a","chief-scientist","bank");active(s,"c");
  const attack=give(s,"c","pr-crisis"),defend=give(s,"b","crisis-pr-team");
  cmd(s,"c","effect",{cardId:attack.id,targetId:"a"});cmd(s,"a","pass");
  cmd(s,"b","react",{cardId:defend.id});assert.equal(s.pending,null);
  give(s,"a","pr-crisis","effects");give(s,"a","pr-crisis","effects");
  assert.equal(valuation(s,"a"),25);active(s,"b");
  const cleanup=give(s,"b","crisis-pr-team");
  cmd(s,"b","effect",{cardId:cleanup.id,targetId:"a",assetId:s.players[0].effects[0].id});
  assert.equal(valuation(s,"a"),100);assert.equal(s.plays,1);
  active(s,"a");const betray=give(s,"a","pr-crisis");
  cmd(s,"a","effect",{cardId:betray.id,targetId:"b"});
  assert.deepEqual(s.pending.responders,["b"]);
  assert.ok(!legalMoves(s,"a").some(m=>m.command.type==='react'||m.command.type==='pass'));
  reactPass(s);assert.equal(s.alliances.length,1);assert.equal(allCards(s).length,98);
});
test("Steal Customer only takes Contracts and keeps them banked", () => {
  const s = ready();
  active(s);
  const employee = give(s, "b", "chief-scientist", "bank"),
    contract = give(s, "b", "government-contract", "bank"),
    attack = give(s, "a", "steal-customer");
  assert.throws(() =>
    cmd(s, "a", "effect", {
      cardId: attack.id,
      targetId: "b",
      assetId: employee.id,
    }),
  );
  cmd(s, "a", "effect", {
    cardId: attack.id,
    targetId: "b",
    assetId: contract.id,
  });
  reactPass(s);
  assert.equal(valuation(s, "a"), 175);
  assert.equal(valuation(s, "b"), 175);
  assert.equal(allCards(s).length, 98);
});
test("Backchannel enforces seven cards and never draws itself when reshuffling", () => {
  const s = ready();
  active(s);
  const back = give(s, "a", "investor-backchannel");
  while (s.players[0].hand.length < 7) s.players[0].hand.push(s.deck.pop());
  cmd(s, "a", "effect", { cardId: back.id });
  assert.equal(s.players[0].hand.length, 8);
  assert.ok(legalMoves(s, "a").every((m) => m.command.type === "discard"));
  cmd(s, "a", "discard", { cardId: s.players[0].hand[0].id });
  assert.equal(s.players[0].hand.length, 7);
  const empty = ready();
  active(empty);
  const b = give(empty, "a", "investor-backchannel");
  empty.players[1].bank.push(...empty.deck.splice(0));
  const recyclable = empty.players[1].bank.pop();
  empty.discard.push(recyclable);
  const before = empty.players[0].hand.length;
  cmd(empty, "a", "effect", { cardId: b.id });
  assert.equal(empty.players[0].hand.length, before);
  assert.ok(empty.players[0].hand.some((c) => c.id === recyclable.id));
  assert.ok(!empty.players[0].hand.some((c) => c.id === b.id));
  assert.equal(allCards(empty).length, 98);
});
