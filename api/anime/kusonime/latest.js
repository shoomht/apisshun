import { latest } from './_kuso-lib.js';
export default [{
  metode: 'GET', endpoint: '/api/anime/kusonime/latest',
  name: 'kusonime latest', category: 'Anime',
  description: 'Latest anime updates from Kusonime.',
  tags: ['ANIME', 'KUSONIME', 'LATEST'],
  params: [],
  paramsSchema: {},
  cache: true, cacheTTL: 60000, isPremium: false,
  async run() {
    try {
      return { status: true, data: await latest() };
    } catch (e) { return { status: false, error: e.message, code: 500 }; }
  },
}];
