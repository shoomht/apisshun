import axios from 'axios';
import * as cheerio from 'cheerio';
async function scrape() {
    const page = Math.floor(20 * Math.random()) + 1;
    const url = `https://rimbakita.com/daftar-nama-hewan-lengkap/${page}/`;
    try {
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        const html = response.data;
        const $ = cheerio.load(html);
        const json = $("div.entry-content.entry-content-single img[class*=wp-image-][data-src]")
            .map((_, el) => {
            const src = $(el).attr("data-src");
            if (!src) {
                return null;
            }
            const titleMatch = src.split("/").pop();
            const title = titleMatch
                ? titleMatch.replace(/-/g, " ").replace(/\..+$/, "")
                : "Unknown Animal";
            return {
                title: title.charAt(0).toUpperCase() + title.slice(1),
                url: src,
            };
        })
            .get()
            .filter((item) => item !== null);
        if (json.length === 0) {
            throw new Error("No animals found");
        }
        return json;
    }
    catch (error) {
        console.error("API Error:", error.message);
        throw new Error("Failed to fetch animal data");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/games/tebakhewan",
        name: "tebak hewan",
        category: "Games",
        description: "This API endpoint provides a random list of animals with their images, suitable for a guessing game ('Tebak Hewan').",
        tags: ["Games", "Animals", "Guessing Game", "Education", "Images"],
        example: "",
        parameters: [],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            try {
                const data = await scrape();
                if (!data) {
                    return {
                        status: false,
                        error: "No result returned from API",
                        code: 500,
                    };
                }
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
