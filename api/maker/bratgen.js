import { bratGen } from 'brat-canvas';

/**
 * Generates a Brat-style (Charli XCX album cover style) image from text
 * using the brat-canvas package, rendered locally without calling any
 * external API.
 */
async function generateBratImage(text) {
    try {
        const buffer = await bratGen(text);
        return buffer;
    }
    catch (error) {
        console.error("brat-canvas image generation error:", error.message);
        throw new Error("Failed to generate brat image");
    }
}

export default [
    {
        metode: "GET",
        endpoint: "/api/m/bratgen",
        name: "brat generator",
        category: "Maker",
        description: "Generates a Brat-style (Charli XCX album cover style) image from text, rendered locally using brat-canvas.",
        tags: ["MAKER", "IMAGE", "BRAT", "CANVAS"],
        example: "?text=kangen masa lalu ya?",
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
                description: "The text to render on the brat-style image",
                example: "kangen masa lalu ya?",
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
                const buffer = await generateBratImage(text.trim());
                res.set({
                    "Content-Type": "image/png",
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
