import { gameDb } from '../../../db';
import { handleFunnel } from '../../../lib/funnel-api';
export async function POST(request: Request) {
  try { return await handleFunnel(request, gameDb(), 'event'); }
  catch { return Response.json({ error: 'Tracking unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
