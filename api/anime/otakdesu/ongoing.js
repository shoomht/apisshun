import axios from 'axios';
import * as cheerio from 'cheerio';
import { proxy } from '../../../src/utils/globals.js';
const baseUrl = "https://otakudesu.cloud/";
async function getOngoingAnime() {
    try {
        const { data } = await axios.get(proxy() + baseUrl, {
            timeout: 30000,
        });
        const $ = cheerio.load(data);
        const results = [];
        $(".venz ul li").each((index, element) => {
            const episode = $(element).find(".epz").text().trim();
            const type = $(element).find(".epztipe").text().trim();
            const date = $(element).find(".newnime").text().trim();
            const title = $(element).find(".jdlflm").text().trim();
            const link = $(element).find("a").attr("href");
            const image = $(element).find("img").attr("src");
            results.push({
                episode,
                type,
                date,
                title,
                link,
                image,
            });
        });
        return results;
    }
    catch (error) {
        console.error("API Error:", error.message);
        throw new Error("Failed to get response from API");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/anime/otakudesu/ongoing",
        name: "otakudesu ongoing",
        category: "Anime",
        description: "This API endpoint provides a list of ongoing anime series from Otakudesu.",
        tags: ["Anime", "Otakudesu", "Ongoing"],
        example: "",
        parameters: [],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            try {
                const data = await getOngoingAnime();
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
