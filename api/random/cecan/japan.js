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
async function getRandomCecanJapanImage() {
    try {
        const GIST_URL = "https://raw.githubusercontent.com/siputzx/Databasee/refs/heads/main/cecan/japan.json";
        const { data: imageUrls } = await axios.get(GIST_URL, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
            throw new Error("No image URLs found in the GIST.");
        }
        const randomImageUrl = imageUrls[Math.floor(Math.random() * imageUrls.length)];
        const imageResponse = await axios.get(randomImageUrl, {
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
        throw new Error("Failed to get random Japanese cecan image from API");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/r/cecan/japan",
        name: "random cecan japan",
        category: "Random",
        description: "This API endpoint provides a random image of Japanese 'cecan' (beautiful women).",
        tags: ["Random", "Image", "Japan"],
        example: "",
        parameters: [],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req, res }) {
            try {
                const imageData = await getRandomCecanJapanImage();
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
