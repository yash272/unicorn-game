import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.GAME_TEST_URL || "http://localhost:5173";
function client() {
  let cookie = "";
  return {
    async request(path, body, extra = {}) {
      const r = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(cookie ? { Cookie: cookie } : {}),
          ...extra,
        },
        ...(body === undefined
          ? {}
          : { body: typeof body === "string" ? body : JSON.stringify(body) }),
      });
      const set = r.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      return {
        status: r.status,
        data: r.headers.get("content-type")?.includes("application/json")
          ? await r.json()
          : { error: await r.text() },
        headers: r.headers,
      };
    },
  };
}
test("rooms preserve privacy, reconnect, reject stale/concurrent moves, and finish a full game", async () => {
  const clients = Array.from({ length: 6 }, client),
    created = await clients[0].request("/api/game", { name: "Trial host" });
  assert.equal(created.status, 201);
  assert.match(created.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  const path = "/api/game/" + created.data.code;
  const stranger = await clients[1].request(path);
  assert.equal(stranger.status, 403);
  assert.equal(stranger.data.needsJoin, true);
  assert.equal(stranger.data.players, undefined);
  for (let i = 1; i < 5; i++)
    assert.equal(
      (
        await clients[i].request(path, {
          type: "join",
          name: "Trial player " + i,
        })
      ).status,
      200,
    );
  assert.equal(
    (await clients[5].request(path, { type: "join", name: "Too many" })).status,
    400,
  );
  let table = (await clients[0].request(path)).data;
  const move = async (index, command) => {
    const v = (await clients[index].request(path)).data;
    const r = await clients[index].request(path, {
      revision: v.revision,
      command,
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return r.data;
  };
  table = await move(0, { type: "start" });
  const sessions = new Map();
  for (let i = 0; i < 5; i++) {
    let v = (await clients[i].request(path)).data;
    sessions.set(v.you, i);
    assert.equal(
      v.players.some((p) => "hand" in p || "tokenHash" in p),
      false,
    );
    assert.equal(v.deck, undefined);
    assert.equal(v.hand.length, 5);
    assert.equal(v.choices.length, 3);
    table = await move(i, { type: "choose", key: v.choices[0] });
  }
  const actor = sessions.get(table.turn),
    v = (await clients[actor].request(path)).data;
  const others = clients.filter((_, i) => i !== actor);
  assert.equal(
    (
      await others[0].request(path, {
        revision: v.revision,
        command: { type: "draw" },
      })
    ).status,
    400,
  );
  const races = await Promise.all([
    clients[actor].request(path, {
      revision: v.revision,
      command: { type: "draw" },
    }),
    clients[actor].request(path, {
      revision: v.revision,
      command: { type: "draw" },
    }),
  ]);
  assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (
      await clients[actor].request(path, {
        revision: v.revision,
        command: { type: "end" },
      })
    ).status,
    409,
  );
  const before = (await clients[actor].request(path)).data,
    after = (await clients[actor].request(path)).data;
  assert.deepEqual(after.hand, before.hand);
  assert.equal(after.you, before.you);
  let steps = 0;
  while (table.phase !== "finished" && steps++ < 500) {
    table = (await clients[0].request(path)).data;
    if (table.phase === "finished") break;
    const i = sessions.get(table.turn);
    const state = (await clients[i].request(path)).data;
    const command =
      state.moves.find((m) => m.command.type === "discard")?.command ||
      state.moves.find((m) => m.command.type === "draw")?.command ||
      state.moves
        .filter((m) => m.command.type === "bank")
        .sort((a, b) => {
          const value = (x) => Number(x.label.match(/\+\$(\d+)M/)?.[1] || 0);
          return value(b) - value(a);
        })[0]?.command ||
      state.moves.find((m) => m.command.type === "end")?.command;
    assert.ok(command);
    table = await move(i, command);
  }
  assert.equal(table.phase, "finished");
  assert.ok(table.players.find((p) => p.id === table.winner).valuation >= 1000);
  assert.ok(
    (await clients[0].request(path)).data.moves.some(
      (m) => m.command.type === "start",
    ),
  );
});
test("malformed and cross-site requests are rejected as client errors", async () => {
  const c = client();
  assert.equal((await c.request("/api/game", "{")).status, 400);
  assert.equal(
    (
      await c.request(
        "/api/game",
        { name: "Trial" },
        { Origin: "https://untrusted.example" },
      )
    ).status,
    403,
  );
});

test("Scandal reveals privately through the API and transfers only the chosen card", async () => {
  const clients = Array.from({length: 3}, client);
  const created = await clients[0].request('/api/game', {name: 'Scandal host'});
  assert.equal(created.status,201);
  const path='/api/game/'+created.data.code;
  for(let i=1;i<3;i++) assert.equal((await clients[i].request(path,{type:'join',name:'Scandal player '+i})).status,200);
  const move = async (i,command) => {
    const before=(await clients[i].request(path)).data;
    const response=await clients[i].request(path,{revision:before.revision,command});
    assert.equal(response.status,200,JSON.stringify(response.data));
    return response.data;
  };
  await move(0,{type:'start'});
  const seats=new Map();
  for(let i=0;i<3;i++) {
    const v=(await clients[i].request(path)).data;seats.set(v.you,i);
    assert.equal(v.deckCount+v.players.reduce((n,p)=>n+p.handCount,0),98);
    await move(i,{type:'choose',key:v.choices[0]});
  }
  let actor;
  for(let turns=0;turns<140;turns++) {
    const table=(await clients[0].request(path)).data;
    const i=seats.get(table.turn);
    let v=await move(i,{type:'draw'});
    while(v.hand.length>7) v=await move(i,v.moves.find(m=>m.command.type==='discard' && !m.command.cardId.startsWith('founder-scandal:'))?.command || v.moves.find(m=>m.command.type==='discard').command);
    if(v.hand.some(c=>c.key==='founder-scandal')) {actor=i;break;}
    await move(i,{type:'end'});
  }
  assert.notEqual(actor,undefined,'The two Scandal cards must be reachable from the 98-card draw pile');
  const actorView=(await clients[actor].request(path)).data;
  const effect=actorView.moves.find(m=>m.command.type==='effect' && actorView.hand.find(c=>c.id===m.command.cardId)?.key==='founder-scandal');
  assert.ok(effect);
  const target=seats.get(effect.command.targetId);
  const observer=[0,1,2].find(i=>i!==actor && i!==target);
  const original=(await clients[target].request(path)).data.hand;
  await move(actor,effect.command);
  await move(target,{type:'pass'});
  const reveal=(await clients[actor].request(path)).data;
  assert.deepEqual(reveal.reveal,original);
  for(const i of [target,observer]) {
    const hidden=(await clients[i].request(path)).data;
    assert.equal(hidden.reveal,undefined);assert.equal(hidden.pending.cards,undefined);
    assert.ok(!hidden.moves.some(m=>m.command.type==='steal'));
  }
  const chosen=original.at(-1);
  const forged=await clients[observer].request(path,{revision:reveal.revision,command:{type:'steal',cardId:chosen.id}});
  assert.equal(forged.status,400);
  const stolen=await move(actor,{type:'steal',cardId:chosen.id});
  assert.ok(stolen.hand.some(c=>c.id===chosen.id));
  assert.equal(stolen.reveal,undefined);assert.equal(stolen.pending,null);
  assert.deepEqual((await clients[target].request(path)).data.hand,original.slice(0,-1));
  assert.equal(stolen.players[actor].valuation,50);
});

test("alliance trades need both players' agreement and expose only the two offers to partners", async () => {
  const clients=Array.from({length:3},client);
  const created=await clients[0].request('/api/game',{name:'Alliance host'});
  assert.equal(created.status,201);
  const path='/api/game/'+created.data.code;
  for(let i=1;i<3;i++) assert.equal((await clients[i].request(path,{type:'join',name:'Alliance player '+i})).status,200);
  const move=async(i,command)=>{
    const v=(await clients[i].request(path)).data;
    const r=await clients[i].request(path,{revision:v.revision,command});
    assert.equal(r.status,200,JSON.stringify(r.data));return r.data;
  };
  await move(0,{type:'start'});
  const seats=new Map();
  for(let i=0;i<3;i++) {
    const v=(await clients[i].request(path)).data;seats.set(v.you,i);
    await move(i,{type:'choose',key:v.choices[0]});
  }
  let actor;
  for(let turn=0;turn<140;turn++) {
    const table=(await clients[0].request(path)).data;
    const i=seats.get(table.turn);let v=await move(i,{type:'draw'});
    while(v.hand.length>7) {
      const keep=new Set(v.hand.filter(c=>c.key==='strategic-alliance').map(c=>c.id));
      v=await move(i,v.moves.find(m=>m.command.type==='discard'&&!keep.has(m.command.cardId))?.command || v.moves.find(m=>m.command.type==='discard').command);
    }
    if(v.hand.some(c=>c.key==='strategic-alliance')) {actor=i;break;}
    await move(i,{type:'end'});
  }
  assert.notEqual(actor,undefined);
  const v=(await clients[actor].request(path)).data;
  const invitation=v.moves.find(m=>m.command.type==='effect'&&v.hand.find(c=>c.id===m.command.cardId)?.key==='strategic-alliance');
  assert.ok(invitation);
  const target=seats.get(invitation.command.targetId),observer=[0,1,2].find(i=>i!==actor&&i!==target);
  await move(actor,invitation.command);
  const allied=await move(target,{type:'accept'});
  assert.equal(allied.alliances.length,1);
  assert.ok(allied.players.every(p=>p.valuation===50));
  const a=(await clients[actor].request(path)).data,b=(await clients[target].request(path)).data;
  const offered=a.hand[0],returned=b.hand[1];
  await move(actor,{type:'trade',cardId:offered.id,targetId:b.you});
  const pending=(await clients[target].request(path)).data;
  assert.equal(pending.trade.offered.id,offered.id);
  assert.deepEqual(pending.hand,b.hand);
  const hidden=(await clients[observer].request(path)).data;
  assert.equal(hidden.trade,undefined);assert.ok(!JSON.stringify(hidden.pending).includes(offered.id));
  const premature=await clients[actor].request(path,{revision:pending.revision,command:{type:'trade-accept'}});
  assert.equal(premature.status,400);
  await move(target,{type:'trade-response',cardId:returned.id});
  const confirm=(await clients[actor].request(path)).data;
  assert.equal(confirm.trade.returned.id,returned.id);assert.deepEqual(confirm.hand,a.hand);
  assert.equal((await clients[observer].request(path)).data.trade,undefined);
  const swapped=await move(actor,{type:'trade-accept'});
  assert.deepEqual(swapped.hand,[...a.hand.slice(1),returned]);
  assert.deepEqual((await clients[target].request(path)).data.hand,[...b.hand.filter(c=>c.id!==returned.id),offered]);
  assert.equal(swapped.plays,0);assert.equal(swapped.pending,null);
  assert.ok(swapped.players.every(p=>p.valuation===50));
  assert.equal(swapped.alliances.length,1);
});
