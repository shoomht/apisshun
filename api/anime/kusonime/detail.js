import { detail } from './_kuso-lib.js';
export default [{
  metode: 'GET', endpoint: '/api/anime/kusonime/detail',
  name: 'kusonime detail', category: 'Anime',
  description: 'Anime detail incl. synopsis, info, and download links. Accepts a Kusonime URL or slug.',
  tags: ['ANIME', 'KUSONIME', 'DETAIL'],
  params: ['url'],
  paramsSchema: { url: { type: 'string', required: true, min: 1 } },
  cache: true, cacheTTL: 120000, isPremium: false,
  async run({ req }) {
    try {
      const url = req.query.url || req.body?.url;
      return { status: true, data: await detail(url) };
    } catch (e) { return { status: false, error: e.message, code: 500 }; }
  },
}];
