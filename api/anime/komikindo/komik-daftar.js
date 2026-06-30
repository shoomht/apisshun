import { daftarManga } from './_komikindo-lib.js';
export default [{
  metode: 'GET', endpoint: '/api/anime/komikindo/daftar',
  name: 'komikindo daftar manga', category: 'Komik',
  description: 'Paginated list of all manga on Komikindo.',
  tags: ['KOMIK', 'MANGA', 'LIST'],
  params: ['page'],
  paramsSchema: { page: { type: 'integer', required: false, min: 1, default: 1 } },
  cache: true, cacheTTL: 120000, isPremium: false,
  async run({ req }) {
    try {
      const page = parseInt(req.query.page) || 1;
      return { status: true, data: await daftarManga(page) };
    } catch (e) { return { status: false, error: e.message, code: 500 }; }
  },
}];
