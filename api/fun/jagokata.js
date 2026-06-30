import * as cheerio from 'cheerio';
import axios from 'axios';
async function scrape(q) {
    try {
        const response = await axios.post("https://jagokata.com/kata-bijak/cari.html", new URLSearchParams({
            citaat: q,
            zoekbutton: "Zoeken",
        }), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 30000,
        });
        const data = response.data;
        const $ = cheerio.load(data);
        return $("#main #content #content-container #images-container ul li, #main #content #content-container #citatenrijen li")
            .map((_, el) => ({
            quote: $(el).find(".quotebody .fbquote").text().trim(),
            link: `https://jagokata.com${$(el).find("a").attr("href")}`,
            img: $(el).find(".quotebody img").attr("data-src"),
            author: $(el)
                .find(".citatenlijst-auteur > a, .auteurfbnaam")
                .text()
                .trim(),
            description: $(el)
                .find(".citatenlijst-auteur > .auteur-beschrijving")
                .text()
                .trim(),
            lifespan: $(el)
                .find(".citatenlijst-auteur > .auteur-gebsterf")
                .text()
                .trim(),
            votes: $(el).find(".votes-content > .votes-positive").text().trim(),
            category: $("#main").find("h1.kamus").text().trim(),
            tags: $(el).attr("id"),
        }))
            .get();
    }
    catch (error) {
        throw new Error("Error fetching data from JagoKata: " + error.message);
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/fun/jagokata",
        name: "jagokata",
        category: "Fun",
        description: "This API endpoint allows you to search for quotes on jagokata.com, a popular Indonesian website for quotes and sayings.",
        tags: ["Fun", "Quotes", "Motivation", "Inspiration"],
        example: "?q=kesuksesan",
        parameters: [
            {
                name: "q",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 100,
                },
                description: "The query to search for quotes",
                example: "kesuksesan",
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            const { q } = req.query || {};
            if (!q) {
                return {
                    status: false,
                    error: "Query parameter is required",
                    code: 400,
                };
            }
            if (typeof q !== "string" || q.trim().length === 0) {
                return {
                    status: false,
                    error: "Query parameter must be a non-empty string",
                    code: 400,
                };
            }
            if (q.length > 100) {
                return {
                    status: false,
                    error: "Query parameter must be less than 100 characters",
                    code: 400,
                };
            }
            try {
                const result = await scrape(q.trim());
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
