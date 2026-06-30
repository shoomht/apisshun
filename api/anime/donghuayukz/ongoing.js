import { getOngoing } from './_dy-lib.js';
export default [{
  metode: 'GET', endpoint: '/api/anime/donghuayukz/ongoing',
  name: 'donghuayukz ongoing', category: 'Donghua',
  description: 'List of currently ongoing donghua (paginated).',
  tags: ['DONGHUA', 'ANIME', 'ONGOING'],
  params: ['page'],
  paramsSchema: { page: { type: 'integer', required: false, min: 1, default: 1 } },
  cache: true, cacheTTL: 60000, isPremium: false,
  async run({ req }) {
    try {
      const page = parseInt(req.query.page) || 1;
      return { status: true, data: await getOngoing(page) };
    } catch (e) { return { status: false, error: e.message, code: 500 }; }
  },
}];
