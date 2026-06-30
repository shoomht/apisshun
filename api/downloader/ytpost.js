import axios from 'axios';
import * as cheerio from 'cheerio';
async function scrapeYoutubeCommunity(url) {
    try {
        const { data: response } = await axios.get(url);
        const $ = cheerio.load(response);
        const ytInitialData = JSON.parse($("script")
            .text()
            .match(/ytInitialData = ({.*?});/)?.[1] || "{}");
        const posts = ytInitialData.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents
            .flatMap((section) => section.itemSectionRenderer?.contents || [])
            .map((item) => {
            const postRenderer = item.backstagePostThreadRenderer?.post?.backstagePostRenderer;
            if (!postRenderer)
                return null;
            const images = postRenderer.backstageAttachment?.postMultiImageRenderer
                ?.images || [];
            const imageUrls = images.map((imageObj) => {
                const thumbnails = imageObj.backstageImageRenderer.image.thumbnails;
                return thumbnails[thumbnails.length - 1].url;
            });
            return {
                postId: postRenderer.postId,
                author: postRenderer.authorText.simpleText,
                content: postRenderer.contentText?.runs
                    ?.map((run) => run.text)
                    .join("") || "",
                images: imageUrls,
            };
        })
            .filter(Boolean);
        return posts[0] || null;
    }
    catch (error) {
        console.error("Youtube Community scrape error:", error.message);
        throw new Error("Failed to get response from API");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/d/ytpost",
        name: "Youtube Community",
        category: "Youtube Downloader",
        description: "This API endpoint scrapes the latest post from a YouTube channel's community tab.",
        tags: ["YOUTUBE", "DOWNLOADER", "COMMUNITY", "SCRAPER"],
        example: "?url=https://www.youtube.com/@YouTubeCreators/community",
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
                description: "The URL of the YouTube channel's community tab",
                example: "https://www.youtube.com/@YouTubeCreators/community",
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
                const result = await scrapeYoutubeCommunity(url.trim());
                if (!result) {
                    return {
                        status: false,
                        error: "Failed to fetch community post or no post found",
                        code: 404,
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
