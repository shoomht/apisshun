import axios from 'axios';
import * as cheerio from 'cheerio';
const base_url = "https://www.liputan6.com";
async function scrapeLiputan6News() {
    try {
        const response = await axios.get(base_url);
        const $ = cheerio.load(response.data);
        let result = [];
        const isi = $(".articles--iridescent-list article");
        isi.each((i, e) => {
            const title = $(".articles--iridescent-list--text-item__title-link-text", e)
                .text()
                .trim();
            const link = $("h4.articles--iridescent-list--text-item__title a", e).attr("href");
            const image_thumbnail = $("picture.articles--iridescent-list--text-item__figure-image img", e).attr("src");
            const time = $(".articles--iridescent-list--text-item__time", e).text().trim();
            if (title && link) {
                result.push({ title, link, image_thumbnail, time });
            }
        });
        return result;
    }
    catch (error) {
        console.error("Error scraping Liputan6 News:", error.message);
        throw new Error(error.message || "Failed to scrape Liputan6 News");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/berita/liputan6",
        name: "liputan6",
        category: "Berita",
        description: "This API endpoint fetches the latest news headlines from Liputan6.com, a prominent Indonesian online news portal.",
        tags: ["BERITA", "NEWS", "INDONESIA", "CURRENT EVENTS"],
        example: "",
        parameters: [],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            try {
                const data = await scrapeLiputan6News();
                return { status: true, data: data, timestamp: new Date().toISOString() };
            }
            catch (error) {
                return { status: false, error: error.message || "Internal Server Error", code: 500 };
            }
        },
    }
];
