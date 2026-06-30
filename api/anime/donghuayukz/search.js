import { searchDonghua } from './_dy-lib.js';
export default [{
  metode: 'GET', endpoint: '/api/anime/donghuayukz/search',
  name: 'donghuayukz search', category: 'Donghua',
  description: 'Search donghua by title.',
  tags: ['DONGHUA', 'ANIME', 'SEARCH'],
  params: ['query', 'page', 'mode'],
  paramsSchema: {
    query: { type: 'string', required: true, min: 1 },
    page: { type: 'integer', required: false, min: 1, default: 1 },
    mode: { type: 'string', required: false, default: 'donghua' },
  },
  cache: true, cacheTTL: 120000, isPremium: false,
  async run({ req }) {
    try {
      const q = req.query.query || req.body?.query;
      const page = parseInt(req.query.page) || 1;
      const mode = req.query.mode || 'donghua';
      return { status: true, data: await searchDonghua(q, page, mode) };
    } catch (e) { return { status: false, error: e.message, code: 500 }; }
  },
}];
