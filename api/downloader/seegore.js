import axios from 'axios';
import * as cheerio from 'cheerio';
async function scrapeSeegore(url) {
    try {
        const response = await axios.get(url, {
            timeout: 30000,
        });
        const html = response.data;
        const $ = cheerio.load(html);
        const title = $("h1.entry-title.s-post-title.bb-mb-el[itemprop=\"headline\"]")
            .text()
            .trim();
        const author = $("div.bb-author-vcard-mini span[itemprop=\"name\"]")
            .text()
            .trim();
        const postedOn = $("time.entry-date.published").attr("datetime");
        const commentsCount = $("a.post-meta-item.post-comments .count")
            .text()
            .trim();
        const viewsCount = $("span.post-meta-item.post-views .count")
            .first()
            .text()
            .trim();
        const ratingValue = $(".wpd-rating-value .wpdrv").text().trim();
        const ratingCount = $(".wpd-rating-value .wpdrc").text().trim();
        const ratingVotes = $(".wpd-rating-title").next().text().trim();
        const videoSrc = $("video.wp-video-shortcode source[type=\"video/mp4\"]").attr("src");
        return {
            title: title,
            author: author,
            postedOn: postedOn,
            commentsCount: commentsCount,
            viewsCount: viewsCount,
            rating: {
                value: ratingValue,
                count: ratingCount,
                votes: ratingVotes,
            },
            videoSrc: videoSrc,
        };
    }
    catch (error) {
        console.error("Error fetching data:", error);
        throw new Error(error.message || "Failed to get response from API");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/d/seegore",
        name: "seegore",
        category: "Downloader",
        description: "This API endpoint allows you to fetch article data from a Seegore URL using query parameters.",
        tags: ["Downloader", "Article", "Video", "Scraper", "Seegore"],
        example: "?url=https://seegore.com/train-gives-a-warm-welcome-to-grandma",
        parameters: [
            {
                name: "url",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    minLength: 1,
                },
                description: "The Seegore article URL to fetch data from",
                example: "https://seegore.com/train-gives-a-warm-welcome-to-grandma",
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
                const result = await scrapeSeegore(url.trim());
                if (!result) {
                    return {
                        status: false,
                        error: "Failed to fetch article data",
                        code: 500,
                    };
                }
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
