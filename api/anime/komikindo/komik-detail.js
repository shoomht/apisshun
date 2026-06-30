import { detailKomik } from './_komikindo-lib.js';
export default [{
  metode: 'GET', endpoint: '/api/anime/komikindo/detail',
  name: 'komikindo detail', category: 'Komik',
  description: 'Full manga detail incl. synopsis, genres, and chapter list. Accepts a slug or full komik URL.',
  tags: ['KOMIK', 'MANGA', 'DETAIL'],
  params: ['slug'],
  paramsSchema: { slug: { type: 'string', required: true, min: 1 } },
  cache: true, cacheTTL: 120000, isPremium: false,
  async run({ req }) {
    try {
      const slug = req.query.slug || req.body?.slug;
      return { status: true, data: await detailKomik(slug) };
    } catch (e) { return { status: false, error: e.message, code: 500 }; }
  },
}];
