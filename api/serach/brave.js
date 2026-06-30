import axios from 'axios';
import * as cheerio from 'cheerio';
async function scrapeBrave(query) {
    try {
        const response = await axios.get(`https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        const $ = cheerio.load(response.data);
        const results = [];
        $(".snippet").each((i, element) => {
            const result = {
                title: $(element).find(".title").text().trim(),
                description: $(element).find(".snippet-description").text().trim(),
                url: $(element).find(".h").attr("href"),
                imageUrl: $(element).find(".thumbnail img").attr("src"),
                siteName: $(element).find(".sitename").text().trim(),
                date: $(element)
                    .find(".snippet-description")
                    .text()
                    .split("-")[0]
                    .trim(),
            };
            Object.keys(result).forEach((key) => {
                if (!result[key]) {
                    delete result[key];
                }
            });
            if (Object.keys(result).length > 1) {
                results.push(result);
            }
        });
        const metadata = {
            totalResults: results.length,
            searchQuery: query,
            timestamp: new Date().toISOString(),
        };
        return { metadata, results };
    }
    catch (error) {
        console.error("API Error:", error.message);
        throw new Error("Failed to get response from API");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/s/brave",
        name: "brave",
        category: "Search",
        description: "This API endpoint performs a web search using the Brave search engine.",
        tags: ["Search", "Brave", "Web"],
        example: "?query=apa itu nodejs",
        parameters: [
            {
                name: "query",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 500,
                },
                description: "The search query",
                example: "apa itu nodejs",
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
            if (query.length > 500) {
                return {
                    status: false,
                    error: "Query must be less than 500 characters",
                    code: 400,
                };
            }
            try {
                const data = await scrapeBrave(query.trim());
                return {
                    status: true,
                    data: data,
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
