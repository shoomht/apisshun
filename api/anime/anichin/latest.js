import axios from 'axios';
import * as cheerio from 'cheerio';
import { proxy } from '../../../src/utils/globals.js';
async function scrapeLatestAnime() {
    try {
        const domain = "https://anichin.team/";
        const response = await axios.get(proxy() + domain, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        const $domain = cheerio.load(response.data);
        const redirectScriptContent = $domain("script").filter(function () {
            return $domain(this).html()?.includes("setTimeout");
        }).html();
        if (!redirectScriptContent) {
            throw new Error("Redirect script content not found");
        }
        const urlMatch = redirectScriptContent.match(/location\.href = '(https:\/\/[^']+)'/);
        if (!urlMatch || !urlMatch[1]) {
            throw new Error("Redirect URL not found in script");
        }
        const { data } = await axios.get(proxy() + urlMatch[1], {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        const $ = cheerio.load(data);
        const results = [];
        $(".listupd.normal .bs").each((_, element) => {
            const linkElement = $(element).find("a");
            const title = linkElement.attr("title");
            const url = linkElement.attr("href");
            const episode = $(element).find(".bt .epx").text().trim();
            const thumbnail = $(element).find("img").attr("src");
            const type = $(element).find(".typez").text().trim();
            results.push({
                title: title,
                url: url,
                episode: episode,
                thumbnail: thumbnail,
                type: type,
            });
        });
        return results;
    }
    catch (error) {
        console.error("API Error:", error.message);
        throw new Error("Error scraping latest anime: " + error.message);
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/anime/anichin-latest",
        name: "anichin latest",
        category: "Anime",
        description: "This API endpoint provides the latest anime updates from Anichin.",
        tags: ["ANIME", "LATEST", "SCRAPING"],
        example: "",
        parameters: [],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            try {
                const data = await scrapeLatestAnime();
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
