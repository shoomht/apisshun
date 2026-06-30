import got from 'got';
import * as cheerio from 'cheerio';
async function scrapeKompasNews() {
    try {
        const response = await got("https://news.kompas.com", {
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
        $(".articleList.-list .articleItem").each((_, element) => {
            const $article = $(element);
            const title = $article.find(".articleTitle").text().trim();
            const link = $article.find(".article-link").attr("href");
            const image = $article.find(".articleItem-img img").data("src");
            const category = $article.find(".articlePost-subtitle").text().trim();
            const date = $article.find(".articlePost-date").text().trim();
            if (title && link) {
                results.push({
                    title,
                    link,
                    image,
                    category,
                    date,
                });
            }
        });
        return results;
    }
    catch (error) {
        console.error("Error scraping Kompas News:", error);
        throw new Error(error.message || "Failed to scrape Kompas News");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/berita/kompas",
        name: "kompas news",
        category: "Berita",
        description: "This API endpoint allows you to retrieve the latest news headlines and articles from Kompas.com, one of Indonesia's p...",
        tags: ["BERITA", "NEWS", "INDONESIA", "CURRENT EVENTS"],
        example: "",
        parameters: [],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            try {
                const data = await scrapeKompasNews();
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
