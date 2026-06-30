import { getEpisode } from './_dy-lib.js';
export default [{
  metode: 'GET', endpoint: '/api/anime/donghuayukz/episode',
  name: 'donghuayukz episode', category: 'Donghua',
  description: 'Streaming and download links for a donghua episode by slug.',
  tags: ['DONGHUA', 'ANIME', 'STREAM'],
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
      return { status: true, data: await getEpisode(slug, mode) };
    } catch (e) { return { status: false, error: e.message, code: 500 }; }
  },
}];
