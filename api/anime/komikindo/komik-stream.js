import { streamChapter } from './_komikindo-lib.js';
export default [{
  metode: 'GET', endpoint: '/api/anime/komikindo/stream',
  name: 'komikindo chapter images', category: 'Komik',
  description: 'Get all page image URLs for a chapter, plus prev/next navigation. Accepts a chapter slug or URL.',
  tags: ['KOMIK', 'MANGA', 'READER'],
  params: ['slug'],
  paramsSchema: { slug: { type: 'string', required: true, min: 1 } },
  cache: true, cacheTTL: 120000, isPremium: false,
  async run({ req }) {
    try {
      const slug = req.query.slug || req.body?.slug;
      return { status: true, data: await streamChapter(slug) };
    } catch (e) { return { status: false, error: e.message, code: 500 }; }
  },
}];
