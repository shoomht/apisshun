import got from 'got';
import * as cheerio from 'cheerio';
async function scrapeMerdekaNews() {
    try {
        const response = await got("https://www.merdeka.com/peristiwa/", {
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
        $(".box-headline ul li.item").each((_, element) => {
            const $item = $(element);
            const title = $item.find(".item-title a").text().trim();
            let link = $item.find(".item-title a").attr("href");
            let image = $item.find(".item-img img").attr("src");
            const category = $item.find(".item-tag").text().trim();
            const date = $item.find(".item-date").text().trim();
            const description = $item.find(".item-description").text().trim();
            if (image && !image.startsWith("http")) {
                image = "https://www.merdeka.com" + image;
            }
            if (link && !link.startsWith("http")) {
                link = "https://www.merdeka.com" + link;
            }
            if (title && link) {
                results.push({
                    title,
                    link,
                    image,
                    category,
                    date,
                    description,
                });
            }
        });
        return results;
    }
    catch (error) {
        console.error("Error scraping Merdeka News:", error);
        throw new Error(error.message || "Failed to scrape Merdeka News");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/berita/merdeka",
        name: "merdeka news",
        category: "Berita",
        description: "This API endpoint allows you to retrieve the latest news headlines from Merdeka.com, specifically from its 'Peristiwa...",
        tags: ["BERITA", "NEWS", "INDONESIA", "CURRENT EVENTS"],
        example: "",
        parameters: [],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            try {
                const data = await scrapeMerdekaNews();
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
