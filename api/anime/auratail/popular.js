import axios from 'axios';
import * as cheerio from 'cheerio';
import { proxy } from '../../../src/utils/globals.js';
async function scrapeData() {
    try {
        const url = 'https://auratail.vip';
        const { data } = await axios.get(proxy() + url, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        const $ = cheerio.load(data);
        const results = [];
        $('div.listupd.normal')
            .first()
            .find('article.bs')
            .each((_, el) => {
            const title = $(el).find('div.tt h2').text().trim();
            const episodeLink = $(el).find('a').attr('href')?.trim();
            if (title && episodeLink) {
                results.push({ title, link: episodeLink });
            }
        });
        return results;
    }
    catch (error) {
        console.error("API Error:", error.message);
        throw new Error("Failed to scrape data from Auratail");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/anime/auratail-popular",
        name: "auratail popular",
        category: "Anime",
        description: "This API endpoint retrieves a list of popular anime from the Auratail website.",
        tags: ["ANIME", "Popular", "Trending", "Scraping"],
        example: "",
        parameters: [],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            try {
                const data = await scrapeData();
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
