import axios from 'axios';

async function tiktokDownload(url) {
  const { data } = await axios.get('https://www.tiktokdl.web.id/api/tiktok', {
    params: { url },
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 30000,
  });

  return {
    status: data.status,
    id: data.id,
    description: data.description,
    author: data.author,
    duration: data.duration,
    stats: {
      likes: data.stats?.like ?? null,
      views: data.stats?.views ?? null,
      shares: data.stats?.share ?? null,
      comments: data.stats?.comment ?? null,
    },
    music: {
      title: data.music?.title ?? null,
      author: data.music?.author ?? null,
      duration: data.music?.duration ?? null,
    },
    video_url: data.videoId,
    audio_url: data.audioId,
  };
}

export default [
  {
    metode: 'GET',
    endpoint: '/api/downloader/tiktokweb',
    name: 'tiktok downloader (web.id)',
    category: 'Downloader',
    description: 'Download TikTok video and audio without watermark, including stats and music metadata.',
    tags: ['DOWNLOADER', 'TIKTOK', 'VIDEO'],
    params: ['url'],
    paramsSchema: {
      url: { type: 'url', required: true },
    },
    cache: true,
    cacheTTL: 60000,
    isPremium: false,
    async run({ req }) {
      try {
        const url = req.query.url || req.body?.url;
        const data = await tiktokDownload(url);
        return { status: true, data };
      } catch (error) {
        return { status: false, error: error.message || 'Failed to download TikTok', code: 500 };
      }
    },
  },
];
