import axios from 'axios';
import * as cheerio from 'cheerio';
async function scrapeLatestNews() {
    try {
        const response = await axios.get("https://www.sindonews.com/", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        const $ = cheerio.load(response.data);
        const articles = [];
        $(".list-article").each((index, element) => {
            const title = $(element).find(".title-article").text().trim();
            const link = $(element).find("a").attr("href");
            const category = $(element).find(".sub-kanal").text().trim();
            const timestamp = $(element).find(".date-article").text().trim();
            const imageUrl = $(element).find("img.lazyload").attr("data-src");
            if (title && link) {
                articles.push({
                    title,
                    link,
                    category,
                    timestamp,
                    imageUrl,
                });
            }
        });
        return articles;
    }
    catch (error) {
        console.error("Error scraping Sindonews:", error.message);
        throw new Error(error.message || "Failed to scrape Sindonews");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/berita/sindonews",
        name: "sindonews",
        category: "Berita",
        description: "This API endpoint provides access to the latest news headlines from Sindonews.com, a major Indonesian news portal.",
        tags: ["BERITA", "NEWS", "INDONESIA", "CURRENT EVENTS"],
        example: "",
        parameters: [],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            try {
                const data = await scrapeLatestNews();
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
