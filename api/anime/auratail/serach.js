import axios from 'axios';
import * as cheerio from 'cheerio';
import { proxy } from '../../../src/utils/globals.js';
async function scrape(query) {
    try {
        const url = `https://auratail.vip/?s=${encodeURIComponent(query)}`;
        const { data } = await axios.get(proxy() + url, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        const $ = cheerio.load(data);
        const results = [];
        $('#content .listupd article').each((_, el) => {
            const title = $(el).find('.tt h2').text().trim();
            const link = $(el).find('a').attr('href');
            const image = $(el).find('.lazyload').attr('data-src') ||
                $(el).find('noscript img').attr('src');
            const status = $(el).find('.status').text().trim() ||
                $(el).find('.bt .epx').text().trim();
            results.push({ title, link, image, status });
        });
        return results;
    }
    catch (error) {
        console.error("API Error:", error.message);
        throw new Error("Failed to get response from API");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/anime/auratail-search",
        name: "auratail search",
        category: "Anime",
        description: "This API endpoint allows you to search for anime on Auratail by providing a search query.",
        tags: ["ANIME", "Search", "Scraping"],
        example: "?query=war",
        parameters: [
            {
                name: "query",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 100,
                },
                description: "Anime search query",
                example: "war",
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            const { query } = req.query || {};
            if (!query) {
                return {
                    status: false,
                    error: "Query parameter is required",
                    code: 400,
                };
            }
            if (typeof query !== "string" || query.trim().length === 0) {
                return {
                    status: false,
                    error: "Query parameter must be a non-empty string",
                    code: 400,
                };
            }
            try {
                const results = await scrape(query.trim());
                return {
                    status: true,
                    data: results,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return {
                    status: false,
                    error: error.message || "Internal Server Error",
                    code: 500,
                };
            }
        },
    }
];
