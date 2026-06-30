// Kusonime scraper core, extracted from the WhatsApp bot plugin.
import axios from 'axios';
import * as cheerio from 'cheerio';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function listing(action, query) {
  const targetUrl = action === 'search'
    ? `https://kusonime.com/?s=${encodeURIComponent(query)}&post_type=post`
    : 'https://kusonime.com/';
  const { data } = await axios.get(targetUrl, { headers, timeout: 30000 });
  const $ = cheerio.load(data);
  const results = [];
  $('.venz ul .detpost').each((i, el) => {
    const title = $(el).find('h2.episodeye a').text().trim() || $(el).find('.content h2 a').text().trim();
    const url = $(el).find('h2.episodeye a').attr('href') || $(el).find('.content h2 a').attr('href') || $(el).find('a').first().attr('href');
    const thumb = $(el).find('.thumb img').attr('src');
    const date = $(el).find('.content p').first().text().trim();
    const genres = [];
    $(el).find('.content p a').each((j, a) => genres.push($(a).text().trim()));
    if (title && url) results.push({ title, thumb, date, genres: genres.join(', '), url });
  });
  if (results.length === 0) {
    throw new Error(action === 'search' ? 'Anime not found' : 'Failed to fetch latest anime');
  }
  return results;
}

export const search = (query) => {
  if (!query) throw new Error('Query is required');
  return listing('search', query);
};
export const latest = () => listing('latest', '');

export async function detail(queryOrUrl) {
  if (!queryOrUrl) throw new Error('URL or slug is required');
  let targetUrl = queryOrUrl.trim();
  if (!targetUrl.startsWith('http')) {
    targetUrl = targetUrl.includes('kusonime.com')
      ? `https://${targetUrl}`
      : `https://kusonime.com/${targetUrl.replace(/^\/+|\/+$/g, '')}/`;
  }
  const { data } = await axios.get(targetUrl, { headers, timeout: 30000 });
  const $ = cheerio.load(data);

  const title = $('.jdlz').first().text().trim() || $('.venser h1').first().text().trim();
  const thumb = $('.post-thumb img').first().attr('src') || $('.venser img').first().attr('src') || '';
  if (!title || title.includes('Updatan Terbaru')) {
    throw new Error('Failed to parse. Make sure the URL is a Kusonime detail-post link.');
  }

  let sinopsis = '';
  $('.lexot p').each((i, el) => {
    const text = $(el).text().trim();
    if (!$(el).find('b').length && !$(el).find('strong').length && text.length > 15) sinopsis += text + '\n\n';
  });
  sinopsis = sinopsis.trim();

  const info = {};
  $('.info p').each((i, el) => {
    const bText = $(el).find('b').text().trim();
    const fullText = $(el).text().trim();
    if (bText && fullText.includes(':')) {
      const key = bText.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
      info[key] = fullText.substring(fullText.indexOf(':') + 1).trim();
    }
  });

  const downloads = [];
  $('.smokeddlrh, .dlbod, .dlbox').each((i, el) => {
    const resTitle = $(el).find('.smokettlrh').text().trim() || $(el).find('b').first().text().trim() || 'Download';
    const linkGroups = [];
    $(el).find('.smokeurlrh, .smokeurl').each((j, row) => {
      const resolution = $(row).find('strong').text().trim() || 'Res';
      const links = [];
      $(row).find('a').each((k, a) => links.push({ host: $(a).text().trim(), url: $(a).attr('href') }));
      if (links.length) linkGroups.push({ resolution, links });
    });
    if (linkGroups.length) downloads.push({ title: resTitle, list: linkGroups });
  });

  return { title, thumb, ...info, sinopsis, downloads };
}
