import { bratVid } from 'brat-canvas/video';

/**
 * Generates a Brat-style animated video (MP4) from text using the
 * brat-canvas/video subpath export.
 */
async function generateBratVideo(text) {
    try {
        const buffer = await bratVid(text, { outputFormat: 'mp4' });
        return buffer;
    }
    catch (error) {
        console.error("brat-canvas video generation error:", error.message);
        throw new Error("Failed to generate brat video");
    }
}

export default [
    {
        metode: "GET",
        endpoint: "/api/m/bratvid",
        name: "brat video generator",
        category: "Maker",
        description: "Generates a Brat-style animated video (MP4) from text, rendered locally using brat-canvas/video.",
        tags: ["MAKER", "VIDEO", "BRAT", "CANVAS"],
        example: "?text=mending tidur gweh mah",
        parameters: [
            {
                name: "text",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 500,
                },
                description: "The text to render on the brat-style video",
                example: "mending tidur gweh mah",
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req, res }) {
            const { text } = req.query || {};
            if (!text) {
                return {
                    status: false,
                    error: "Parameter text is required",
                    code: 400,
                };
            }
            if (typeof text !== "string" || text.trim().length === 0) {
                return {
                    status: false,
                    error: "Parameter text must be a non-empty string",
                    code: 400,
                };
            }
            if (text.length > 500) {
                return {
                    status: false,
                    error: "Parameter text must be 500 characters or fewer",
                    code: 400,
                };
            }
            try {
                const buffer = await generateBratVideo(text.trim());
                res.set({
                    "Content-Type": "video/mp4",
                    "Content-Length": buffer.length.toString(),
                    "Cache-Control": "public, max-age=3600",
                });
                return res.status(200).send(buffer);
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
