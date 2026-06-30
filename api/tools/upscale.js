import axios from 'axios';
import form_data from 'form-data';
import { Buffer } from 'buffer';
import { fileTypeFromBuffer } from 'file-type';
import { receiveFile } from '../../src/utils/upload.js';
class PicsArtUpscaler {
    authToken = null;
    uploadUrl = "https://upload.picsart.com/files";
    enhanceUrl = "https://ai.picsart.com/gw1/diffbir-enhancement-service/v1.7.6";
    jsUrl = "https://picsart.com/-/landings/4.290.0/static/index-msH24PNW-B73n3SC9.js";
    async getAuthToken() {
        if (this.authToken)
            return this.authToken;
        const response = await axios.get(this.jsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36'
            }
        });
        const tokenMatch = response.data.match(/"x-app-authorization":"Bearer ([^"]+)"/);
        if (!tokenMatch)
            throw new Error('Token not found');
        this.authToken = `Bearer ${tokenMatch[1]}`;
        return this.authToken;
    }
    async uploadBuffer(buffer) {
        await this.getAuthToken();
        const formData = new form_data();
        formData.append('type', 'editing-temp-landings');
        formData.append('file', buffer, {
            filename: 'image.jpeg',
            contentType: 'image/jpeg'
        });
        formData.append('url', '');
        formData.append('metainfo', '');
        const response = await axios.post(this.uploadUrl, formData, {
            headers: {
                ...formData.getHeaders(),
                'authority': 'upload.picsart.com',
                'accept': '*/*',
                'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'origin': 'https://picsart.com',
                'referer': 'https://picsart.com/',
                'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36'
            }
        });
        return response.data.result.url;
    }
    async uploadFromUrl(imageUrl) {
        await this.getAuthToken();
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(imageResponse.data);
        return await this.uploadBuffer(buffer);
    }
    async enhanceImage(imageUrl, targetScale = 4) {
        const scale = Math.max(1, Math.min(20, targetScale));
        const params = new URLSearchParams({
            picsart_cdn_url: imageUrl,
            format: 'PNG',
            model: 'REALESERGAN'
        });
        const payload = {
            image_url: imageUrl,
            colour_correction: {
                enabled: false,
                blending: 0.5
            },
            face_enhancement: {
                enabled: true,
                blending: 1,
                max_faces: 1000,
                impression: false,
                gfpgan: true,
                node: "ada"
            },
            seed: 42,
            upscale: {
                enabled: true,
                node: "esrgan",
                target_scale: scale
            }
        };
        const response = await axios.post(`${this.enhanceUrl}?${params.toString()}`, payload, {
            headers: {
                'authority': 'ai.picsart.com',
                'accept': 'application/json',
                'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'content-type': 'application/json',
                'origin': 'https://picsart.com',
                'referer': 'https://picsart.com/',
                'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
                'x-app-authorization': this.authToken,
                'x-touchpoint': 'widget_EnhancedImage',
                'x-touchpoint-referrer': '/image-upscale/'
            }
        });
        return response.data;
    }
    async checkStatus(jobId) {
        const response = await axios.get(`${this.enhanceUrl}/${jobId}`, {
            headers: {
                'authority': 'ai.picsart.com',
                'accept': 'application/json',
                'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                'origin': 'https://picsart.com',
                'referer': 'https://picsart.com/',
                'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"Android"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
                'x-app-authorization': this.authToken
            }
        });
        return response.data;
    }
    async waitForCompletion(jobId, { maxAttempts = 60, intervalMs = 2000 } = {}) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const status = await this.checkStatus(jobId);
            if (status.status === 'DONE') {
                return status.result.image_url;
            }
            if (status.status === 'FAILED') {
                throw new Error(`Enhancement failed: ${status.error_message}`);
            }
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        // Bail out instead of looping forever if the job never resolves —
        // otherwise the request (and, off Vercel, the connection) hangs.
        throw new Error(
            `Enhancement timed out after ${(maxAttempts * intervalMs) / 1000}s.`
        );
    }
    async downloadBuffer(url) {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    }
    async upscale(input, targetScale = 4) {
        let uploadedUrl;
        if (Buffer.isBuffer(input)) {
            uploadedUrl = await this.uploadBuffer(input);
        }
        else if (typeof input === 'string') {
            uploadedUrl = await this.uploadFromUrl(input);
        }
        else {
            throw new Error('Input must be Buffer or URL string');
        }
        const enhanceResponse = await this.enhanceImage(uploadedUrl, targetScale);
        const resultUrl = await this.waitForCompletion(enhanceResponse.id);
        return await this.downloadBuffer(resultUrl);
    }
}
const upscaler = new PicsArtUpscaler();
const createImageResponse = (buffer, filename = null) => {
    const headers = {
        "Content-Type": "image/png",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
    };
    if (filename) {
        headers["Content-Disposition"] = `inline; filename="${filename}"`;
    }
    return { buffer, headers };
};
async function UpscaleImageFromUrl(imageUrl, scale = 4) {
    const result = await upscaler.upscale(imageUrl, scale);
    return {
        buffer: result,
        scale: scale
    };
}
async function UpscaleImageFromFile(imageBuffer, scale = 4, fileName = "image.jpg") {
    const fileType = await fileTypeFromBuffer(imageBuffer);
    if (!fileType || !fileType.mime.startsWith("image/")) {
        throw new Error("Unsupported file type, only images are allowed.");
    }
    const result = await upscaler.upscale(imageBuffer, scale);
    return {
        buffer: result,
        scale: scale
    };
}
export default [
    {
        metode: "GET",
        endpoint: "/api/tools/upscale",
        name: "upscale",
        category: "Tools",
        description: "This API endpoint upscales/enhances an image using PicsArt AI enhancement service.",
        tags: ["TOOLS", "IMAGE", "UPSCALE", "ENHANCEMENT", "AI"],
        example: "?url=https://files.catbox.moe/258vhm.jpg&scale=4",
        parameters: [
            {
                name: "url",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    format: "url",
                    minLength: 1,
                    maxLength: 2048,
                },
                description: "The URL of the image to upscale.",
                example: "https://files.catbox.moe/258vhm.jpg",
            },
            {
                name: "scale",
                in: "query",
                required: false,
                schema: {
                    type: "number",
                    minimum: 1,
                    maximum: 20,
                    default: 4,
                },
                description: "The upscale factor (1-20). Higher values produce larger images.",
                example: 4,
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req, res }) {
            const { url, scale } = req.query || {};
            if (!url) {
                return {
                    status: false,
                    error: "Parameter 'url' is required.",
                    code: 400,
                };
            }
            if (typeof url !== "string" || url.trim().length === 0) {
                return {
                    status: false,
                    error: "Parameter 'url' must be a non-empty string.",
                    code: 400,
                };
            }
            const targetScale = scale ? parseInt(scale) : 4;
            if (isNaN(targetScale) || targetScale < 1 || targetScale > 20) {
                return {
                    status: false,
                    error: "Parameter 'scale' must be a number between 1 and 20.",
                    code: 400,
                };
            }
            try {
                new URL(url.trim());
                const result = await UpscaleImageFromUrl(url.trim(), targetScale);
                const __imgResp = createImageResponse(result.buffer);
                res.set(__imgResp.headers);
                return res.status(200).send(__imgResp.buffer);
            }
            catch (error) {
                console.error("Error:", error);
                return {
                    status: false,
                    error: error.message || "Internal Server Error",
                    code: 500,
                };
            }
        },
    },
    {
        metode: "POST",
        endpoint: "/api/tools/upscale",
        name: "upscale (upload)",
        category: "Tools",
        description:
            "Upscale/enhance an uploaded image using the PicsArt AI enhancement service. " +
            "Send a multipart/form-data request with an image file (field name 'file' or 'image') " +
            "and an optional 'scale' field. Returns the enhanced image (PNG).",
        tags: ["TOOLS", "IMAGE", "UPSCALE", "ENHANCEMENT", "AI", "UPLOAD"],
        // Tells the OpenAPI generator to render a multipart file-upload body.
        upload: true,
        uploadField: "file",
        paramsSchema: {
            scale: { type: "integer", min: 1, max: 20, default: 4 },
        },
        parameters: [
            {
                name: "scale",
                in: "query",
                required: false,
                schema: { type: "integer", minimum: 1, maximum: 20, default: 4 },
                description: "Upscale factor (1-20). Can also be sent as a form field. Defaults to 4.",
                example: 4,
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req, res }) {
            let file;
            try {
                file = await receiveFile(req, res);
            }
            catch (error) {
                return {
                    status: false,
                    error: error.message || "Upload failed.",
                    code: error.code || 400,
                };
            }
            if (!file || !file.buffer || file.buffer.length === 0) {
                return {
                    status: false,
                    error:
                        "No image uploaded. Send a multipart/form-data request with an image file " +
                        "in the 'file' (or 'image') field.",
                    code: 400,
                };
            }
            // scale may arrive as a multipart form field (parsed by multer into
            // req.body) or as a query param. Prefer body, then query.
            const rawScale =
                (req.body && req.body.scale) ?? (req.query && req.query.scale);
            const targetScale = rawScale !== undefined && rawScale !== "" ? parseInt(rawScale) : 4;
            if (isNaN(targetScale) || targetScale < 1 || targetScale > 20) {
                return {
                    status: false,
                    error: "Parameter 'scale' must be a number between 1 and 20.",
                    code: 400,
                };
            }
            try {
                const result = await UpscaleImageFromFile(
                    file.buffer,
                    targetScale,
                    file.originalname || "image.jpg"
                );
                const __imgResp = createImageResponse(result.buffer);
                res.set(__imgResp.headers);
                return res.status(200).send(__imgResp.buffer);
            }
            catch (error) {
                console.error("Error:", error);
                return {
                    status: false,
                    error: error.message || "Internal Server Error",
                    code: 500,
                };
            }
        },
    }
];
