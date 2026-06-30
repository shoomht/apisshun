import axios from 'axios';
import * as cheerio from 'cheerio';
async function caridanDetailResep(query) {
    try {
        const searchResponse = await axios.get("https://resepkoki.id/?s=" + query);
        const $search = cheerio.load(searchResponse.data);
        const linkPromises = [];
        const recipes = [];
        $search("body > div.all-wrapper.with-animations > div:nth-child(5) > div > div.archive-posts.masonry-grid-w.per-row-2 > div.masonry-grid > div > article > div > div.archive-item-content > header > h3 > a").each((index, element) => {
            const judul = $search(element).text();
            const link = $search(element).attr("href");
            if (link && link.startsWith("https://resepkoki.id/resep")) {
                recipes.push({ judul, link });
                linkPromises.push(axios.get(link));
            }
        });
        const detailResponses = await Promise.all(linkPromises);
        const result = detailResponses.map((response, index) => {
            const $detail = cheerio.load(response.data);
            const abahan = [];
            const atakaran = [];
            const atahap = [];
            $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-panel-details > div > div.single-recipe-ingredients-nutritions > div > table > tbody > tr > td:nth-child(2) > span.ingredient-name").each((a, b) => {
                abahan.push($detail(b).text());
            });
            $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-panel-details > div > div.single-recipe-ingredients-nutritions > div > table > tbody > tr > td:nth-child(2) > span.ingredient-amount").each((c, d) => {
                atakaran.push($detail(d).text());
            });
            $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-panel-main > div.single-content > div.single-steps > table > tbody > tr > td.single-step-description > div > p").each((e, f) => {
                atahap.push($detail(f).text());
            });
            const judul = $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-title.title-hide-in-desktop > h1").text();
            const waktu = $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-panel-main > div.single-meta > ul > li.single-meta-cooking-time > span").text();
            const hasil = $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-panel-main > div.single-meta > ul > li.single-meta-serves > span")
                .text()
                .split(": ")[1] || "";
            const level = $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-panel-main > div.single-meta > ul > li.single-meta-difficulty > span")
                .text()
                .split(": ")[1] || "";
            const thumb = $detail("body > div.all-wrapper.with-animations > div.single-panel.os-container > div.single-panel-details > div > div.single-main-media > img").attr("src");
            let tbahan = "bahan\n";
            for (let i = 0; i < abahan.length; i++) {
                tbahan += abahan[i] + " " + atakaran[i] + "\n";
            }
            let ttahap = "tahap\n";
            for (let i = 0; i < atahap.length; i++) {
                ttahap += atahap[i] + "\n\n";
            }
            return {
                judul,
                waktu_masak: waktu,
                hasil,
                tingkat_kesulitan: level,
                thumb,
                bahan: tbahan.split("bahan\n")[1],
                langkah_langkah: ttahap.split("tahap\n")[1],
            };
        });
        return result;
    }
    catch (error) {
        throw error;
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/s/resep",
        name: "resep koki",
        category: "Search",
        description: "This API endpoint allows you to search for recipes on ResepKoki.id and retrieve detailed information about them.",
        tags: ["Recipe", "Food", "Cooking", "Search"],
        example: "?query=ayam goreng",
        parameters: [
            {
                name: "query",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 100,
                },
                description: "The search query for recipes (e.g., 'ayam goreng', 'nasi goreng').",
                example: "nasi goreng",
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            const { query } = req.query || {};
            if (!query) {
                return {
                    status: false,
                    error: "Query parameter is required",
                    code: 400,
                };
            }
            if (typeof query !== "string" || query.trim().length === 0) {
                return {
                    status: false,
                    error: "Query parameter must be a non-empty string",
                    code: 400,
                };
            }
            try {
                const result = await caridanDetailResep(query.trim());
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
