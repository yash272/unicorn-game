/** The printed URLs are permanent campaign entry points. Never repurpose them. */
export const iveyCampaign = 'ivey_launch';
export const iveySource = 'ivey_poster';
export const iveyVariants = ['build', 'cto', 'billion'];

/** @param {Record<string, string | undefined>} attribution */
export function isIveyPoster(attribution) {
  return attribution.utm_source === iveySource
    && attribution.utm_medium === 'offline'
    && [iveyCampaign, `qa-${iveyCampaign}`].includes(attribution.utm_campaign || '')
    && iveyVariants.includes(attribution.utm_content || '');
}

/** @param {Request} request @param {string} variant */
export function redirectIveyPoster(request, variant) {
  if (!iveyVariants.includes(variant)) return new Response('Not found', { status: 404 });
  const incoming = new URL(request.url);
  const destination = new URL('/', incoming.origin);
  destination.searchParams.set('utm_source', iveySource);
  destination.searchParams.set('utm_medium', 'offline');
  // QA uses the same route and funnel, but never contaminates the real experiment.
  destination.searchParams.set('utm_campaign', incoming.searchParams.get('qa') === '1' ? `qa-${iveyCampaign}` : iveyCampaign);
  destination.searchParams.set('utm_content', variant);
  return new Response(null, {
    status: 307,
    headers: {
      Location: destination.href,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
