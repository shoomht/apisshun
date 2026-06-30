import axios from 'axios';
import * as cheerio from 'cheerio';
async function wikipediaScraper(query) {
    try {
        const response = await axios.get(`https://id.m.wikipedia.org/wiki/${encodeURIComponent(query)}`, {
            timeout: 30000,
        });
        const $ = cheerio.load(response.data);
        const wiki = $("#mf-section-0").find("p").text().trim();
        const thumb = $('meta[property="og:image"]').attr("content");
        if (!wiki) {
            throw new Error("Artikel tidak ditemukan atau tidak memiliki deskripsi.");
        }
        return {
            wiki,
            thumb: thumb || "Gambar tidak tersedia",
        };
    }
    catch (error) {
        console.error("API Error:", error.message);
        throw new Error(`Error fetching Wikipedia data: ${error.message}`);
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/s/wikipedia",
        name: "wikipedia",
        category: "Search",
        description: "This API endpoint allows you to search for articles on Wikipedia (Indonesian version) by providing a search query.",
        tags: ["Search", "Wikipedia", "Information", "Knowledge"],
        example: "?query=prabowo",
        parameters: [
            {
                name: "query",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 200,
                },
                description: "The search query for Wikipedia (e.g., 'prabowo', 'jakarta').",
                example: "prabowo",
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
                    error: "Parameter 'query' diperlukan.",
                    code: 400,
                };
            }
            if (typeof query !== "string" || query.trim().length === 0) {
                return {
                    status: false,
                    error: "Query must be a non-empty string.",
                    code: 400,
                };
            }
            if (query.length > 200) {
                return {
                    status: false,
                    error: "Query must be less than 200 characters.",
                    code: 400,
                };
            }
            try {
                const result = await wikipediaScraper(query.trim());
                return {
                    status: true,
                    data: result,
                    timestamp: new Date().toISOString(),
                };
            }
            catch (error) {
                return {
                    status: false,
                    error: error.message || "Terjadi kesalahan pada server.",
                    code: 404,
                };
            }
        },
    }
];
