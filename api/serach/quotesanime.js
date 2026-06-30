import axios from 'axios';
import * as cheerio from 'cheerio';
async function quotesAnime(q) {
    try {
        const { data } = await axios.get(`https://otakotaku.com/quote/search?q=${q}&q_filter=quote`);
        const $ = cheerio.load(data);
        const hasil = [];
        $("div.kotodama-list").each(function (l, h) {
            hasil.push({
                link: $(h).find("a").attr("href"),
                gambar: $(h)
                    .find("img")
                    .attr("data-src")
                    ?.replace("52x71", "157x213"),
                karakter: $(h).find("div.char-name").text().trim(),
                anime: $(h).find("div.anime-title").text().trim(),
                episode: $(h).find("div.meta").text(),
                up_at: $(h).find("small.meta").text(),
                quotes: $(h).find("div.quote").text().trim(),
            });
        });
        return hasil;
    }
    catch (error) {
        throw new Error(`Error fetching quotes: ${error.message}`);
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/s/animequotes",
        name: "quoted anime",
        category: "Search",
        description: "This API endpoint allows you to search for anime quotes from Otakotaku.com.",
        tags: ["Anime", "Quotes", "Search", "Otakotaku"],
        example: "?query=cat",
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
                description: "The search query for anime quotes (e.g., 'sad', 'love', character name).",
                example: "fate",
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
                const result = await quotesAnime(query.trim());
                return {
                    status: true,
                    data: result,
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
