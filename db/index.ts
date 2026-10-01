import { env } from "cloudflare:workers";
export function gameDb() {
  if (!env.DB)
    throw new Error("Game storage is unavailable. Please try again shortly.");
  return env.DB.withSession("first-primary");
}
