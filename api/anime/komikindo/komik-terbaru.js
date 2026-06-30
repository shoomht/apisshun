import { komikTerbaru } from './_komikindo-lib.js';
export default [{
  metode: 'GET', endpoint: '/api/anime/komikindo/terbaru',
  name: 'komikindo komik terbaru', category: 'Komik',
  description: 'Latest updated manga chapters on Komikindo (paginated).',
  tags: ['KOMIK', 'MANGA', 'LATEST'],
  params: ['page'],
  paramsSchema: { page: { type: 'integer', required: false, min: 1, default: 1 } },
  cache: true, cacheTTL: 60000, isPremium: false,
  async run({ req }) {
    try {
      const page = parseInt(req.query.page) || 1;
      return { status: true, data: await komikTerbaru(page) };
    } catch (e) { return { status: false, error: e.message, code: 500 }; }
  },
}];
