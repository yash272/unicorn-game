import { redirectIveyPoster } from '../../lib/ivey-campaign.mjs';
export function GET(request: Request) { return redirectIveyPoster(request, 'billion'); }
