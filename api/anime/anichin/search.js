import axios from 'axios';
import * as cheerio from 'cheerio';
import { proxy } from '../../../src/utils/globals.js';
async function scrape(query) {
    try {
        const url = `${proxy() + "https://anichin.cafe/"}?s=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        const $ = cheerio.load(data);
        const results = [];
        $(".listupd article").each((_, el) => {
            const title = $(el).find(".tt h2").text().trim();
            const type = $(el).find(".typez").text().trim();
            const status = $(el).find(".bt .epx").text().trim();
            const link = $(el).find("a").attr("href");
            const image = $(el).find("img").attr("src");
            results.push({
                title: title,
                type: type,
                status: status,
                link: link,
                image: image,
            });
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
        endpoint: "/api/anime/anichin-search",
        name: "anichin search",
        category: "Anime",
        description: "This API endpoint allows users to search for anime on the Anichin website.",
        tags: ["Anime", "Search", "Anichin"],
        example: "?query=naga",
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
                example: "naga",
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
                    error: "Query is required",
                    code: 400,
                };
            }
            if (typeof query !== "string" || query.trim().length === 0) {
                return {
                    status: false,
                    error: "Query must be a non-empty string",
                    code: 400,
                };
            }
            try {
                const results = await scrape(query.trim());
                if (!results || results.length === 0) {
                    return {
                        status: false,
                        error: "No results found for your query",
                        code: 404,
                    };
                }
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
