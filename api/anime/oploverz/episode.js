import axios from 'axios';
import * as cheerio from 'cheerio';
import { proxy } from '../../../src/utils/globals.js';
async function scrapeOploverzEpisode(animeUrl) {
    try {
        const { data: pageData } = await axios.get(proxy() + animeUrl + "/", {
            headers: {
                "authority": "oploverz.org",
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
                "cache-control": "max-age=0",
                "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132"',
                "sec-ch-ua-mobile": "?1",
                "sec-ch-ua-platform": '"Android"',
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "none",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36",
            },
            timeout: 30000,
        });
        const $ = cheerio.load(pageData);
        const animeData = {
            cover: $(".main-col .cover").attr("src"),
            title: $(".main-col .cover").attr("alt"),
            synopsis: $(".sinops").text().trim(),
            information: {},
            episodeList: [],
        };
        $(".infopost li").each((i, el) => {
            const key = $(el).find("b").text().replace(":", "").trim();
            const value = $(el).text().replace(`${key}:`, "").trim();
            animeData.information[key] = value;
        });
        $(".othereps").each((i, el) => {
            const episodeText = $(el).text().trim();
            const episodeLink = $(el).attr("href");
            if (episodeText && episodeLink) {
                animeData.episodeList.push({
                    episode: episodeText,
                    link: episodeLink,
                });
            }
        });
        return animeData;
    }
    catch (error) {
        console.error("API Error:", error.message);
        throw new Error("Failed to get response from API");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/anime/oploverz-episode",
        name: "oploverz episode",
        category: "Anime",
        description: "This API endpoint allows users to retrieve detailed information and a list of episodes for a specific anime series fr...",
        tags: ["Anime", "Episodes", "Information"],
        example: "?url=https://oploverz.org/mushoku-tensei-isekai-ittara-honki-dasu-s2/",
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
                description: "Oploverz anime series URL",
                example: "https://oploverz.org/mushoku-tensei-isekai-ittara-honki-dasu-s2/",
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
            if (!url.startsWith("https://oploverz.org/")) {
                return {
                    status: false,
                    error: "URL must be from oploverz.org",
                    code: 400,
                };
            }
            try {
                const animeData = await scrapeOploverzEpisode(url.trim());
                if (!animeData) {
                    return {
                        status: false,
                        error: "No result returned from API",
                        code: 500,
                    };
                }
                return {
                    status: true,
                    data: animeData,
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
