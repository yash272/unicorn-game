import { gameDb } from '../../../db';
import { handleFunnel } from '../../../lib/funnel-api';
export async function POST(request: Request) {
  try { return await handleFunnel(request, gameDb(), 'signup'); }
  catch { return Response.json({ error: 'Signups are temporarily unavailable. Please try again shortly.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
