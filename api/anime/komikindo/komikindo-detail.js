import axios from 'axios';
import * as cheerio from 'cheerio';
import { proxy } from '../../../src/utils/globals.js';
async function getBaseUrl() {
    const url = "https://komikindo.cz/";
    try {
        const { data } = await axios.get(proxy() + url);
        const $ = cheerio.load(data);
        const href = $(".elementskit-btn.whitespace--normal").attr("href");
        if (!href) {
            throw new Error("Base URL not found on the page");
        }
        return href;
    }
    catch (error) {
        throw new Error("Error fetching base URL: " + error.message);
    }
}
async function scrapeDetail(urlToScrape) {
    try {
        const baseUrl = await getBaseUrl();
        const finalUrl = urlToScrape.startsWith("http") ? urlToScrape : `${baseUrl}${urlToScrape}`;
        const { data } = await axios.get(proxy() + finalUrl, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        const $ = cheerio.load(data);
        return {
            title: $("h1.entry-title").text().trim(),
            altTitle: $('span:contains("Judul Alternatif:")').text().replace("Judul Alternatif:", "").trim(),
            status: $('span:contains("Status:")').text().replace("Status:", "").trim(),
            author: $('span:contains("Pengarang:")').text().replace("Pengarang:", "").trim(),
            genre: $(".genre-info a").map((_, el) => $(el).text().trim()).get(),
            description: $("#sinopsis .entry-content").text().trim(),
            imageUrl: $("div.thumb img").attr("src"),
            chapters: $("#chapter_list li").map((_, el) => ({
                chapter: $(el).find(".lchx").text().trim(),
                url: $(el).find("a").attr("href"),
            })).get(),
        };
    }
    catch (error) {
        throw new Error("Failed to scrape detail: " + error.message);
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/anime/komikindo-detail",
        name: "komikindo detail",
        category: "Anime",
        description: "This API endpoint allows you to retrieve detailed information about a specific comic or manga from the Komikindo webs...",
        tags: ["ANIME", "MANGA", "KOMIKINDO"],
        example: "?url=https://komikindo.pw/komik/550578-solo-leveling/",
        parameters: [
            {
                name: "url",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 1000,
                },
                description: "The URL of the anime detail page on Komikindo",
                example: "https://komikindo.pw/komik/550578-solo-leveling/",
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            const { url } = req.query || {};
            if (!url) {
                return {
                    status: false,
                    error: "URL parameter is required",
                    code: 400,
                };
            }
            if (typeof url !== "string" || url.trim().length === 0) {
                return {
                    status: false,
                    error: "URL must be a non-empty string",
                    code: 400,
                };
            }
            try {
                const result = await scrapeDetail(url.trim());
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
