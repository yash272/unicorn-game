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
