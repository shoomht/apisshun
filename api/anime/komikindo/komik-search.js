import { search } from './_komikindo-lib.js';
export default [{
  metode: 'GET', endpoint: '/api/anime/komikindo/search',
  name: 'komikindo search', category: 'Komik',
  description: 'Search manga/manhwa/manhua on Komikindo by keyword.',
  tags: ['KOMIK', 'MANGA', 'SEARCH'],
  params: ['query'],
  paramsSchema: { query: { type: 'string', required: true, min: 1 } },
  cache: true, cacheTTL: 120000, isPremium: false,
  async run({ req }) {
    try {
      const query = req.query.query || req.body?.query;
      return { status: true, data: await search(query) };
    } catch (e) { return { status: false, error: e.message, code: 500 }; }
  },
}];
