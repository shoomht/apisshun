import got from 'got';
import * as cheerio from 'cheerio';
async function scrapeAntaraNews() {
    try {
        const response = await got("https://www.antaranews.com", {
            headers: {
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
                accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "accept-language": "en-US,en;q=0.9,id;q=0.8",
            },
            timeout: {
                request: 30000
            },
            retry: {
                limit: 3,
                methods: ["GET"],
                statusCodes: [408, 413, 429, 500, 502, 503, 504],
                errorCodes: [
                    "ETIMEDOUT",
                    "ECONNRESET",
                    "EADDRINUSE",
                    "ECONNREFUSED",
                    "EPIPE",
                    "ENOTFOUND",
                    "ENETUNREACH",
                    "EAI_AGAIN",
                ],
                calculateDelay: (retryObject) => {
                    return Math.min(1000 * Math.pow(2, retryObject.attemptCount), 10000);
                },
            },
        });
        const $ = cheerio.load(response.body);
        const results = [];
        $("#editor_picks .item").each((_, element) => {
            const $item = $(element);
            const title = $item.find(".post_title a").text().trim();
            const link = $item.find(".post_title a").attr("href");
            const image = $item.find("img").data("src");
            const category = $item.find(".list-inline .text-primary").text().trim();
            const isInfographic = $item.find(".format-overlay").length > 0;
            if (title && link) {
                results.push({
                    title,
                    link,
                    image,
                    category,
                    type: isInfographic ? "infographic" : "article",
                });
            }
        });
        return results;
    }
    catch (error) {
        console.error("Error scraping Antara News:", error);
        throw new Error(error.message || "Failed to scrape Antara News");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/berita/antara",
        name: "antara news",
        category: "Berita",
        description: "This API endpoint allows you to retrieve the latest news headlines and articles from Antara News, one of Indonesia's ...",
        tags: ["BERITA", "NEWS", "INDONESIA"],
        example: "",
        parameters: [],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            try {
                const data = await scrapeAntaraNews();
                if (data.length === 0) {
                    return {
                        status: false,
                        error: "No news found",
                        code: 404,
                    };
                }
                return {
                    status: true,
                    data,
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
