import axios from 'axios';
import { Buffer } from 'buffer';
const createImageResponse = (buffer, filename = null) => {
    const headers = {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
    };
    if (filename) {
        headers["Content-Disposition"] = `inline; filename="${filename}"`;
    }
    return { buffer, headers };
};
async function getRandomCatImage() {
    try {
        const API_URL = "https://api.sefinek.net/api/v2/random/animal/cat";
        const { data } = await axios.get(API_URL, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        if (!data || !data.message) {
            throw new Error("Invalid response from external API: Missing image URL.");
        }
        const imageUrl = data.message;
        const imageResponse = await axios.get(imageUrl, {
            responseType: "arraybuffer",
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        return Buffer.from(imageResponse.data, "binary");
    }
    catch (error) {
        console.error("API Error:", error.message);
        throw new Error("Failed to get random cat image from API");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/r/cats",
        name: "random foto kucing",
        category: "Random",
        description: "This API endpoint delivers a random image of a cat.",
        tags: ["Random", "Image", "Cat", "Animal"],
        example: "",
        parameters: [],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req, res }) {
            try {
                const imageData = await getRandomCatImage();
                const __imgResp = createImageResponse(imageData);
                res.set(__imgResp.headers);
                return res.status(200).send(__imgResp.buffer);
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
