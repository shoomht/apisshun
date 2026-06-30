import { search } from './_kuso-lib.js';
export default [{
  metode: 'GET', endpoint: '/api/anime/kusonime/search',
  name: 'kusonime search', category: 'Anime',
  description: 'Search anime on Kusonime by title.',
  tags: ['ANIME', 'KUSONIME', 'SEARCH'],
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
