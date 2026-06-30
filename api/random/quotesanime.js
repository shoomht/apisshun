import axios from 'axios';
import * as cheerio from 'cheerio';
async function getQuotesAnime() {
    try {
        const page = Math.floor(Math.random() * 184);
        const { data } = await axios.get("https://otakotaku.com/quote/feed/" + page, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        const $ = cheerio.load(data);
        const hasil = [];
        $("div.kotodama-list").each(function (l, h) {
            hasil.push({
                link: $(h).find("a").attr("href"),
                gambar: $(h).find("img").attr("data-src"),
                karakter: $(h).find("div.char-name").text().trim(),
                anime: $(h).find("div.anime-title").text().trim(),
                episode: $(h).find("div.meta").text(),
                up_at: $(h).find("small.meta").text(),
                quotes: $(h).find("div.quote").text().trim(),
            });
        });
        if (hasil.length === 0) {
            throw new Error("No quotes found for the given page.");
        }
        return hasil;
    }
    catch (error) {
        console.error("API Error:", error.message);
        throw new Error("Failed to get anime quotes from API");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/r/quotesanime",
        name: "animequotes",
        category: "Random",
        description: "This API endpoint provides random anime quotes.",
        tags: ["Random", "Anime", "Quotes", "Scraper"],
        example: "",
        parameters: [],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            try {
                const result = await getQuotesAnime();
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
