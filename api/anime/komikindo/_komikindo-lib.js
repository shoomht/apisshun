// Shared Komikindo scraper used by the komikindo endpoints.
// Converted from the CLI scraper into ESM with axios + cheerio.
import axios from 'axios';
import * as cheerio from 'cheerio';

export const BASE = 'https://komikindo.ch';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'id-ID,id;q=0.9,en;q=0.7',
  'Referer': BASE + '/',
};

async function load(url) {
  const { data } = await axios.get(url, { headers, timeout: 15000 });
  return cheerio.load(data);
}

function cleanText(text) {
  if (!text) return null;
  return text.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function resolveUrl(input, prefix = '') {
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input.endsWith('/') ? input : input + '/';
  }
  const slug = input.replace(/^\//, '').replace(/\/$/, '');
  const path = prefix ? `${prefix}/${slug}/` : `${slug}/`;
  return `${BASE}/${path}`;
}

export async function search(query) {
  const $ = await load(`${BASE}/?s=${encodeURIComponent(query)}`);
  const results = [];
  $('.bsx, .listupd .bs, .page-item-detail, .animposx, article').each((_, el) => {
    const $el = $(el);
    const link = $el.find('a').first().attr('href') || '';
    const title = $el.find('a').attr('title') || $el.find('.tt, .ttx, h2, h3, .entry-title').first().text().trim();
    const img = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
    const type = $el.find('.type, .limit .ntip, [class*="type"]').first().text().trim();
    const chapter = $el.find('.epxs, .chapternum, .latest-chap, [class*="chapter"]').first().text().trim();
    const rating = $el.find('.numscore, .rating, [class*="rating"]').first().text().trim();
    if (link && title) {
      results.push({
        title: cleanText(title), link,
        slug: link.replace(BASE, '').replace('/komik/', '').replace(/\/$/, ''),
        cover: img, type: type || null, latestChapter: chapter || null, rating: rating || null,
      });
    }
  });
  return { endpoint: 'search', query, total: results.length, results };
}

export async function daftarManga(page = 1) {
  const url = page > 1 ? `${BASE}/daftar-manga/page/${page}/` : `${BASE}/daftar-manga/`;
  const $ = await load(url);
  const results = [];
  $('.bsx, .listupd .bs, .page-item-detail, .animposx').each((_, el) => {
    const $el = $(el);
    const link = $el.find('a').first().attr('href') || '';
    const title = $el.find('a').attr('title') || $el.find('.tt, h2, h3').first().text().trim();
    const img = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
    const type = $el.find('.type, .limit .ntip').first().text().trim();
    const chapter = $el.find('.epxs, .chapternum, .latest-chap').first().text().trim();
    if (link && title) {
      results.push({
        title: cleanText(title), link,
        slug: link.replace(BASE, '').replace('/komik/', '').replace(/\/$/, ''),
        cover: img, type: type || null, latestChapter: chapter || null,
      });
    }
  });
  const nextPage = $('.next, a[rel="next"]').attr('href');
  const totalPages = $('.pagination .page-numbers').last().text().trim() || null;
  return {
    endpoint: 'daftar-manga', page,
    totalPages: totalPages ? parseInt(totalPages) : null,
    hasNext: !!nextPage, nextPage: nextPage || null,
    total: results.length, results,
  };
}

export async function komikTerbaru(page = 1) {
  const url = page > 1 ? `${BASE}/komik-terbaru/page/${page}/` : `${BASE}/komik-terbaru/`;
  const $ = await load(url);
  const results = [];
  $('.bsx, .listupd .bs, .page-item-detail, .animposx, article').each((_, el) => {
    const $el = $(el);
    const link = $el.find('a').first().attr('href') || '';
    const title = $el.find('a').attr('title') || $el.find('.tt, h2, h3, .entry-title').first().text().trim();
    const img = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';
    const type = $el.find('.type, .limit .ntip, [class*="type"]').first().text().trim();
    const chapter = $el.find('.epxs, .chapternum, .latest-chap, [class*="chapter"]').first().text().trim();
    const time = $el.find('.epxdate, [class*="date"], [class*="time"]').first().text().trim();
    if (link && title) {
      results.push({
        title: cleanText(title), link,
        slug: link.replace(BASE, '').replace('/komik/', '').replace(/\/$/, ''),
        cover: img, type: type || null, latestChapter: chapter || null, updatedAt: time || null,
      });
    }
  });
  const nextPage = $('.next, a[rel="next"]').attr('href');
  const totalPages = $('.pagination .page-numbers').last().text().trim() || null;
  return {
    endpoint: 'komik-terbaru', page,
    totalPages: totalPages ? parseInt(totalPages) : null,
    hasNext: !!nextPage, nextPage: nextPage || null,
    total: results.length, results,
  };
}

export async function detailKomik(slug) {
  const url = resolveUrl(slug, 'komik');
  const $ = await load(url);

  const title = cleanText($('.entry-title, h1').first().text());
  const altTitle = cleanText($('.alter, .alternative, [class*="alter"]').first().text()) || null;
  const cover =
    $('.thumb img, .ts-image img, .wp-post-image').first().attr('src') ||
    $('.thumb img, .ts-image img, .wp-post-image').first().attr('data-src') || '';

  const infoMap = {};
  $('.infotable tr, .infox .fmed, .spe span, .tsinfo .imptdt').each((_, el) => {
    const $el = $(el);
    const key = cleanText($el.find('b, th, strong, .imptdt-title').first().text()) || '';
    const val = cleanText($el.find('td, .imptdt-content').last().text()) ||
      cleanText($el.clone().children('b, th, strong, .imptdt-title').remove().end().text());
    if (key && val) infoMap[key.toLowerCase()] = val;
  });

  const pick = (sels, ...keys) => {
    for (const sel of sels) { const v = cleanText($(sel).first().text()); if (v) return v; }
    for (const k of keys) { if (infoMap[k]) return infoMap[k]; }
    return null;
  };

  const status = pick(['.status', '[class*="status"] i', '[class*="status"] span'], 'status');
  const author = pick(['.author a', '[class*="author"] a', '[class*="pengarang"] a', '.author', '[class*="author"]'], 'author', 'pengarang');
  const artist = pick(['.artist a', '[class*="artist"] a', '.artist', '[class*="artist"]'], 'artist', 'ilustrator');
  const type = pick(['.type a', '[class*="type"] a', '.type', '[class*="type"]'], 'type', 'jenis');
  const released = pick(['.year', '[class*="year"]', '[class*="rilis"]'], 'released', 'rilis');
  const rating = cleanText($('.numscore, .rating strong, [class*="rating"] strong, [class*="rating"] span.num').first().text()) || null;
  const voters = cleanText($('.voters, [class*="voters"]').first().text()) || null;

  let synopsis = '';
  $('.entry-content p, .synopsis p, .summary p, [class*="sinopsis"] p, [class*="desc"] p').each((_, el) => {
    const t = cleanText($(el).text());
    if (t && t.length > synopsis.length) synopsis = t;
  });
  if (!synopsis) {
    $('.entry-content, .synopsis, .summary, [class*="sinopsis"], [class*="desc"]').each((_, el) => {
      const t = cleanText($(el).text());
      if (t && t.length > synopsis.length) synopsis = t;
    });
  }

  const genres = [];
  $('.genre a, .mgen a, [class*="genre"] a, [class*="tag"] a').each((_, el) => {
    const g = cleanText($(el).text());
    if (g && !genres.includes(g)) genres.push(g);
  });

  const seen = new Set();
  const chapters = [];
  const addChapter = (chLink, chTitle, chDate) => {
    if (!chLink || !chTitle || seen.has(chLink)) return;
    seen.add(chLink);
    chapters.push({
      title: cleanText(chTitle), link: chLink,
      slug: chLink.replace(BASE, '').replace(/^\//, '').replace(/\/$/, ''),
      date: chDate ? cleanText(chDate) : null,
    });
  };

  $('#chapterlist li, .clstyle li, .eplister li, [id*="chapterlist"] li, [class*="chapter-list"] li').each((_, el) => {
    const $el = $(el); const $a = $el.find('a').first();
    addChapter($a.attr('href') || '',
      cleanText($a.find('.chapternum, .epl-num, [class*="num"]').first().text()) || cleanText($a.text()),
      cleanText($el.find('.chapterdate, .epl-date, [class*="date"], [class*="time"]').first().text()));
  });
  if (chapters.length === 0) {
    $('a').each((_, el) => {
      const $a = $(el); const chLink = $a.attr('href') || ''; const chTitle = cleanText($a.text());
      if (chLink.startsWith(BASE) &&
        (chLink.toLowerCase().includes('chapter') || chLink.toLowerCase().includes('-ch-')) &&
        chTitle && chTitle.length < 120) addChapter(chLink, chTitle, null);
    });
  }

  return {
    endpoint: 'detail', slug, title, alternativeTitle: altTitle, cover, status, author, artist,
    type, released, rating, voters, synopsis: synopsis || null,
    genres, totalChapters: chapters.length, chapters,
  };
}

export async function streamChapter(chapterSlug) {
  const url = resolveUrl(chapterSlug);
  const $ = await load(url);

  const chapterTitle = cleanText($('.entry-title, h1').first().text());
  const prevChapter = $('a.prev_page, .prev-page a, .ch-prev a, a[rel="prev"], .nav-prev a, [class*="prev"] a[href]').first().attr('href') || null;
  const nextChapter = $('a.next_page, .next-page a, .ch-next a, a[rel="next"], .nav-next a, [class*="next"] a[href]').first().attr('href') || null;
  const mangaTitle = cleanText($('.allc a, .series-title a, [class*="manga-title"] a, .breadcrumb a').last().text()) || null;
  const mangaLink = $('.allc a, .series-title a, [class*="manga-title"] a').first().attr('href') || null;

  const seen = new Set();
  const pages = [];
  const isValid = (s) => s && s.trim().length >= 10 && !s.startsWith('data:') && !/blank\.(gif|png|jpg|webp)/i.test(s);
  const addPage = (src, alt, w, h) => {
    const s = (src || '').trim();
    if (!isValid(s) || seen.has(s)) return;
    seen.add(s);
    pages.push({ page: pages.length + 1, url: s, alt: alt || '', width: w ? parseInt(w) : null, height: h ? parseInt(h) : null });
  };
  const extractFromImg = ($img) => addPage(
    $img.attr('data-src') || $img.attr('data-lazy-src') || $img.attr('data-original') ||
    $img.attr('data-url') || $img.attr('data-image') || $img.attr('data-cfsrc') ||
    $img.attr('data-wpfc-original') || $img.attr('src') || '',
    $img.attr('alt') || '', $img.attr('width') || null, $img.attr('height') || null);

  $('script').each((_, el) => {
    const code = $(el).html() || '';
    const tsMatch = code.match(/ts_reader\.run\((\{[\s\S]*?\})\)/);
    if (tsMatch) {
      try { JSON.parse(tsMatch[1]).sources?.forEach(s => (s.images || []).forEach(u => addPage(u, '', null, null))); } catch (_) {}
    }
    [...code.matchAll(/"images"\s*:\s*(\[[\s\S]*?\])/g)].forEach(m => {
      try { JSON.parse(m[1]).forEach(u => typeof u === 'string' && addPage(u, '', null, null)); } catch (_) {}
    });
  });

  $(['#readerarea img', '.ts-main-image img', '.page-break img', '.reading-content img',
     '.reader-area img', '.chapter-content img', '[class*="reader"] img', '[id*="reader"] img',
     '[id*="chapter"] img', '[class*="chapter-img"] img'].join(', '))
    .each((_, el) => extractFromImg($(el)));

  if (pages.length === 0) {
    $('script').each((_, el) => {
      const code = $(el).html() || '';
      const urls = code.match(/https?:\/\/[^\s"'<>\\]+\.(jpg|jpeg|png|webp|gif)(\?[^\s"'<>\\]*)?/gi);
      if (urls) urls.forEach(u => addPage(u.replace(/['"\\,;\s]+$/, ''), '', null, null));
    });
  }
  if (pages.length === 0) {
    $('img').each((_, el) => {
      const $img = $(el);
      const src = $img.attr('data-src') || $img.attr('data-lazy-src') || $img.attr('data-original') || $img.attr('data-cfsrc') || $img.attr('src') || '';
      const w = parseInt($img.attr('width') || '0'), h = parseInt($img.attr('height') || '0');
      if (/\/(wp-content|uploads|manga|komik|chapter|read)\//i.test(src) || w > 300 || h > 300) extractFromImg($img);
    });
  }

  return {
    endpoint: 'stream', chapterSlug, chapterTitle, mangaTitle, mangaLink,
    navigation: { prev: prevChapter, next: nextChapter },
    totalPages: pages.length, pages,
  };
}
