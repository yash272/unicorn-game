import { gameDb } from "../db";
import {
  createRoom,
  joinRoom,
  apply,
  view,
  type Room,
  type Command,
} from "../game/online";
import { z } from "zod";
import catalog from "../game/cards.json";
const createSchema = z
  .object({ name: z.string().trim().min(1).max(24) })
  .strict();
const joinSchema = z
  .object({ type: z.literal("join"), name: z.string().trim().min(1).max(24) })
  .strict();
const moveSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    command: z
      .object({
        type: z.string().max(30),
        cardId: z.string().max(40).optional(),
        targetId: z.string().max(60).optional(),
        assetId: z.string().max(40).optional(),
        key: z.string().max(50).optional(),
      })
      .strict(),
  })
  .strict();
class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
const cookieName = (code: string) => `unicorn_${code}`;
const secret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
const json = (data: unknown, status = 200, cookie?: string) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
function sessionCookie(request: Request, code: string, token: string) {
  return `${cookieName(code)}=${token}; HttpOnly; SameSite=Strict; Path=/api/game; Max-Age=1209600${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
async function body(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new RequestError("Cross-site requests are not allowed.", 403);
  const text = await request.text();
  if (text.length > 4096) throw new RequestError("Request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestError("Please send a valid request.", 400);
  }
}
function credential(request: Request, code: string) {
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName(code) + "="))
      ?.split("=")[1] ?? ""
  );
}
function codeString() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(bytes, (x) => chars[x % chars.length]).join("");
}
async function create(request: Request) {
  const parsed = createSchema.safeParse(await body(request));
  if (!parsed.success)
    return json({ error: "Enter a name between 1 and 24 characters." }, 400);
  const token = secret(),
    id = crypto.randomUUID(),
    s = createRoom(id, parsed.data.name, await hash(token)),
    db = gameDb();
  for (let i = 0; i < 3; i++) {
    const code = codeString();
    const result = await db
      .prepare(
        "INSERT OR IGNORE INTO game_rooms (code,state,revision,updated_at) VALUES (?,?,?,?)",
      )
      .bind(code, JSON.stringify(s), 0, Date.now())
      .run();
    if (result.meta.changes)
      return json(
        { code, ...view(s, id) },
        201,
        sessionCookie(request, code, token),
      );
  }
  throw Error("Could not create a room. Try again.");
}
async function room(request: Request, code: string) {
  if (!/^[A-Z2-9]{8}$/.test(code))
    return json({ error: "Enter the eight-character room code." }, 400);
  const db = gameDb();
  const record = await db
    .prepare(
      "SELECT state, revision, updated_at FROM game_rooms WHERE code = ?",
    )
    .bind(code)
    .first<{ state: string; revision: number; updated_at: number }>();
  if (!record)
    return json({ error: "Room not found. Check the invitation code." }, 404);
  if (Date.now() - record.updated_at > 14 * 86400000)
    return json({ error: "This room has expired. Create a new room." }, 410);
  const s: Room = JSON.parse(record.state);
  if (s.rulesEdition !== catalog.edition)
    return json({ error: "This room uses the previous card rules. Create a new room to play the updated deck.", needsNewRoom: true }, 410);
  const token = credential(request, code);
  const tokenHash = token ? await hash(token) : "";
  let p = s.players.find((p) => p.tokenHash === tokenHash);
  if (request.method === "GET")
    return p
      ? json({ code, ...view(s, p.id) })
      : json({ error: "Join this room to play.", needsJoin: true }, 403);
  const input = await body(request);
  const joining = joinSchema.safeParse(input);
  let newToken: string | undefined;
  if (joining.success) {
    if (p) return json({ code, ...view(s, p.id) });
    newToken = secret();
    const id = crypto.randomUUID();
    try {
      joinRoom(s, id, joining.data.name, await hash(newToken));
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
    p = s.players.find((p) => p.id === id)!;
    s.revision++;
  } else {
    if (!p)
      return json({ error: "Join this room to play.", needsJoin: true }, 403);
    const parsed = moveSchema.safeParse(input);
    if (!parsed.success) return json({ error: "Invalid move." }, 400);
    if (parsed.data.revision !== record.revision)
      return json(
        {
          error: "The table changed. Your move was not applied; choose again.",
        },
        409,
      );
    try {
      apply(s, p.id, parsed.data.command as Command);
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
  }
  const saved = await db
    .prepare(
      "UPDATE game_rooms SET state = ?, revision = ?, updated_at = ? WHERE code = ? AND revision = ?",
    )
    .bind(JSON.stringify(s), s.revision, Date.now(), code, record.revision)
    .run();
  if (!saved.meta.changes)
    return json(
      { error: "Another player moved first. Refresh and choose again." },
      409,
    );
  return json(
    { code, ...view(s, p.id) },
    200,
    newToken ? sessionCookie(request, code, newToken) : undefined,
  );
}
export async function gameRequest(request: Request, code?: string) {
  try {
    return await (code ? room(request, code.toUpperCase()) : create(request));
  } catch (e) {
    if (e instanceof RequestError) return json({ error: e.message }, e.status);
    console.error("UNICORN game request failed:", e);
    return json(
      {
        error:
          "The table could not be reached. Your saved game is safe; please try again.",
      },
      503,
    );
  }
}
