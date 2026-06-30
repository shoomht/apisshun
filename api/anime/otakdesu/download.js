import axios from 'axios';
import * as cheerio from 'cheerio';
import { proxy } from '../../../src/utils/globals.js';
async function getAnimeDownloadLinks(url) {
    try {
        const { data } = await axios.get(proxy() + url, {
            timeout: 30000,
        });
        const $ = cheerio.load(data);
        const episodeInfo = {
            title: $(".download h4").text().trim(),
            downloads: [],
        };
        $(".download ul li").each((index, element) => {
            const quality = $(element).find("strong").text().trim();
            const links = $(element)
                .find("a")
                .map((i, el) => ({
                quality,
                link: $(el).attr("href"),
                host: $(el).text().trim(),
            }))
                .get();
            episodeInfo.downloads.push(...links);
        });
        return episodeInfo;
    }
    catch (error) {
        console.error("API Error:", error.message);
        throw new Error("Failed to get response from API");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/anime/otakudesu/download",
        name: "otakudesu download",
        category: "Anime",
        description: "This API endpoint retrieves available download links for a specific anime episode from Otakudesu.",
        tags: ["Anime", "Otakudesu", "Download"],
        example: "?url=https://otakudesu.cloud/lengkap/btr-nng-sub-indo-part-1/",
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
                description: "Otakudesu anime download page URL",
                example: "https://otakudesu.cloud/lengkap/btr-nng-sub-indo-part-1/",
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
                    error: "URL parameter must be a non-empty string",
                    code: 400,
                };
            }
            try {
                const data = await getAnimeDownloadLinks(url.trim());
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
