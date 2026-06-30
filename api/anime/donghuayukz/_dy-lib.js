// Shared Donghua Yukz client. Proxies the upstream JSON API.
import axios from 'axios';

const BASE_URL = 'https://donghuayukz.netlify.app/api';
const headers = { Accept: 'application/json, text/plain, */*' };

async function get(path, params = {}) {
  const { data } = await axios.get(`${BASE_URL}${path}`, { params, headers, timeout: 30000 });
  return data;
}

export const getOngoing = (page = 1) => get('/donghua/ongoing', { page });
export const searchDonghua = (q, page = 1, mode = 'donghua') => get('/search', { q, page, mode });
export const getEpisode = (slug, mode = 'donghua') => get(`/episode/${slug}`, { mode });
export const getDetail = (slug, mode = 'donghua') => get(`/detail/${slug}`, { mode });
