import { getDetail } from './_dy-lib.js';
export default [{
  metode: 'GET', endpoint: '/api/anime/donghuayukz/detail',
  name: 'donghuayukz detail', category: 'Donghua',
  description: 'Full donghua detail incl. episode list by slug.',
  tags: ['DONGHUA', 'ANIME', 'DETAIL'],
  params: ['slug', 'mode'],
  paramsSchema: {
    slug: { type: 'string', required: true, min: 1 },
    mode: { type: 'string', required: false, default: 'donghua' },
  },
  cache: true, cacheTTL: 120000, isPremium: false,
  async run({ req }) {
    try {
      const slug = req.query.slug || req.body?.slug;
      const mode = req.query.mode || 'donghua';
      return { status: true, data: await getDetail(slug, mode) };
    } catch (e) { return { status: false, error: e.message, code: 500 }; }
  },
}];
