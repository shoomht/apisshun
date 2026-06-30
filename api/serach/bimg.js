import axios from 'axios';
import * as cheerio from 'cheerio';
const AXIOS_OPTIONS = {
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36",
    },
    timeout: 30000,
};
function extractMediaUrl(url) {
    const match = url.match(/mediaurl=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
}
async function scrapeBingImage(query) {
    try {
        const { data } = await axios.get(`https://www.bing.com/images/search?q=${query}`, AXIOS_OPTIONS);
        const $ = cheerio.load(data);
        const result = [];
        $(".imgpt > a").each((i, el) => {
            const mediaUrl = $(el).attr("href");
            if (mediaUrl) {
                const decodedUrl = extractMediaUrl(mediaUrl);
                if (decodedUrl) {
                    result.push(decodedUrl);
                }
            }
        });
        return result;
    }
    catch (error) {
        console.error("API Error:", error.message);
        throw new Error("Failed to get response from API");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/s/bimg",
        name: "bing image",
        category: "Search",
        description: "This API endpoint allows you to search for images using Bing's image search engine.",
        tags: ["Search", "Image", "Bing"],
        example: "?query=kucing",
        parameters: [
            {
                name: "query",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 255,
                },
                description: "Image search query",
                example: "kucing",
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
                    error: "Query must be a non-empty string",
                    code: 400,
                };
            }
            if (query.length > 255) {
                return {
                    status: false,
                    error: "Query must be less than 255 characters",
                    code: 400,
                };
            }
            try {
                const result = await scrapeBingImage(query.trim());
                if (!result) {
                    return {
                        status: false,
                        error: "No result returned from API",
                        code: 500,
                    };
                }
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
