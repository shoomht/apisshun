import axios from 'axios';
import { fileTypeFromBuffer } from 'file-type';
import { receiveFile } from '../../src/utils/upload.js';
import path from 'path';
import { Buffer } from 'buffer';
import form_data from 'form-data';
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
class UpscaleImageAPI {
    api;
    server;
    taskId;
    token;
    constructor() {
        this.api = null;
        this.server = null;
        this.taskId = null;
        this.token = null;
    }
    async getTaskId() {
        try {
            const { data: html } = await axios.get("https://www.iloveimg.com/remove-background", {
                timeout: 10000,
            });
            const tokenMatches = html.match(/(ey[a-zA-Z0-9?%-_/]+)/g);
            if (!tokenMatches || tokenMatches.length < 2) {
                throw new Error("Token not found.");
            }
            this.token = tokenMatches[1];
            const configMatch = html.match(/var ilovepdfConfig = ({.*?});/s);
            if (!configMatch) {
                throw new Error("Server configuration not found.");
            }
            const configJson = JSON.parse(configMatch[1]);
            const servers = configJson.servers;
            if (!Array.isArray(servers) || servers.length === 0) {
                throw new Error("Server list is empty.");
            }
            this.server = servers[Math.floor(Math.random() * servers.length)];
            this.taskId = html.match(/taskId\s*=\s*'(\w+)/)?.[1];
            this.api = axios.create({ baseURL: `https://${this.server}.iloveimg.com`, timeout: 30000 });
            this.api.defaults.headers.post["authorization"] = `Bearer ${this.token}`;
            if (!this.taskId)
                throw new Error("Task ID not found!");
            return { taskId: this.taskId };
        }
        catch (error) {
            throw new Error(`Failed to get Task ID: ${error.message}`);
        }
    }
    async uploadFromUrl(imageUrl) {
        if (!this.taskId || !this.api) {
            throw new Error("Task ID or API not available. Run getTaskId() first.");
        }
        try {
            const imageResponse = await axios.get(imageUrl, {
                responseType: "arraybuffer",
                timeout: 15000,
            });
            const fileType = await fileTypeFromBuffer(imageResponse.data);
            if (!fileType || !fileType.mime.startsWith("image/")) {
                throw new Error("File type is not a supported image.");
            }
            const buffer = Buffer.from(imageResponse.data, "binary");
            const urlPath = new URL(imageUrl).pathname;
            const fileName = path.basename(urlPath) || `image.${fileType.ext}`;
            const form = new form_data();
            form.append("name", fileName);
            form.append("chunk", "0");
            form.append("chunks", "1");
            form.append("task", this.taskId);
            form.append("preview", "1");
            form.append("pdfinfo", "0");
            form.append("pdfforms", "0");
            form.append("pdfresetforms", "0");
            form.append("v", "web.0");
            form.append("file", buffer, { filename: fileName, contentType: fileType.mime });
            const response = await this.api.post("/v1/upload", form, {
                headers: form.getHeaders(),
                data: form,
            });
            return response.data;
        }
        catch (error) {
            throw new Error(`Failed to upload file: ${error.message}`);
        }
    }
    async uploadFromFile(fileBuffer, fileName) {
        if (!this.taskId || !this.api) {
            throw new Error("Task ID or API not available. Run getTaskId() first.");
        }
        try {
            const fileType = await fileTypeFromBuffer(fileBuffer);
            if (!fileType || !fileType.mime.startsWith("image/")) {
                throw new Error("File type is not a supported image.");
            }
            const form = new form_data();
            form.append("name", fileName);
            form.append("chunk", "0");
            form.append("chunks", "1");
            form.append("task", this.taskId);
            form.append("preview", "1");
            form.append("pdfinfo", "0");
            form.append("pdfforms", "0");
            form.append("pdfresetforms", "0");
            form.append("v", "web.0");
            form.append("file", fileBuffer, { filename: fileName, contentType: fileType.mime });
            const response = await this.api.post("/v1/upload", form, {
                headers: form.getHeaders(),
                data: form,
            });
            return response.data;
        }
        catch (error) {
            throw new Error(`Failed to upload file: ${error.message}`);
        }
    }
    async removebgImage(serverFilename) {
        if (!this.taskId || !this.api) {
            throw new Error("Task ID or API not available. Run getTaskId() first.");
        }
        const form = new form_data();
        form.append("task", this.taskId);
        form.append("server_filename", serverFilename);
        try {
            const response = await this.api.post("/v1/removebackground", form, {
                headers: form.getHeaders(),
                data: form,
                responseType: "arraybuffer",
            });
            return response.data;
        }
        catch (error) {
            throw new Error(`Failed to remove background: ${error.message}`);
        }
    }
}
async function scrapeRemoveBgFromUrl(imageUrl) {
    const removebg = new UpscaleImageAPI();
    await removebg.getTaskId();
    const uploadResult = await removebg.uploadFromUrl(imageUrl);
    if (!uploadResult || !uploadResult.server_filename) {
        throw new Error("Failed to upload image.");
    }
    const imageBuffer = await removebg.removebgImage(uploadResult.server_filename);
    return imageBuffer;
}
async function scrapeRemoveBgFromFile(fileBuffer, fileName) {
    const removebg = new UpscaleImageAPI();
    await removebg.getTaskId();
    const uploadResult = await removebg.uploadFromFile(fileBuffer, fileName);
    if (!uploadResult || !uploadResult.server_filename) {
        throw new Error("Failed to upload image.");
    }
    const imageBuffer = await removebg.removebgImage(uploadResult.server_filename);
    return imageBuffer;
}
export default [
    {
        metode: "GET",
        endpoint: "/api/iloveimg/removebg",
        name: "removebg",
        category: "Iloveimg",
        description: "Remove background from an image using a URL as a query parameter.",
        tags: ["ILOVEIMG", "Image Editing", "Background Removal"],
        example: "?image=https://i.pinimg.com/736x/0b/9f/0a/0b9f0a92a598e6c22629004c1027d23f.jpg",
        parameters: [
            {
                name: "image",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    format: "url",
                    minLength: 1,
                    maxLength: 2000,
                },
                description: "Image URL",
                example: "https://i.pinimg.com/736x/0b/9f/0a/0b9f0a92a598e6c22629004c1027d23f.jpg",
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req, res }) {
            const { image } = req.query || {};
            if (!image) {
                return {
                    status: false,
                    error: "Parameter 'image' is required.",
                    code: 400,
                };
            }
            if (typeof image !== "string" || image.trim().length === 0) {
                return {
                    status: false,
                    error: "Parameter 'image' must be a non-empty string.",
                    code: 400,
                };
            }
            try {
                new URL(image.trim());
                const imageBuffer = await scrapeRemoveBgFromUrl(image.trim());
                const fileType = await fileTypeFromBuffer(imageBuffer);
                const contentType = fileType ? fileType.mime : "image/png";
                const __imgResp = createImageResponse(imageBuffer, `removebg_image.png`);
                res.set(__imgResp.headers);
                return res.status(200).send(__imgResp.buffer);
            }
            catch (error) {
                console.error("Error:", error);
                return {
                    status: false,
                    error: error.message || "An error occurred while processing the image.",
                    code: 500,
                };
            }
        },
    },
    {
        metode: "POST",
        endpoint: "/api/iloveimg/removebg",
        name: "removebg (upload)",
        category: "Iloveimg",
        description: "Remove the background of an uploaded image. Send multipart/form-data with an image file (field 'file' or 'image').",
        tags: ["ILOVEIMG", "Background Removal", "UPLOAD"],
        upload: true,
        uploadField: "file",
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req, res }) {
            let file;
            try {
                file = await receiveFile(req, res);
            } catch (error) {
                return { status: false, error: error.message || "Upload failed.", code: error.code || 400 };
            }
            if (!file || !file.buffer || file.buffer.length === 0) {
                return { status: false, error: "No image uploaded. Use a multipart/form-data 'file' (or 'image') field.", code: 400 };
            }
            try {
                const imageBuffer = await scrapeRemoveBgFromFile(file.buffer, file.originalname || "image.png");
                const fileType = await fileTypeFromBuffer(imageBuffer);
                const __imgResp = createImageResponse(imageBuffer, `removebg_image.${fileType?.ext || "png"}`);
                res.set(__imgResp.headers);
                return res.status(200).send(__imgResp.buffer);
            } catch (error) {
                console.error("Error:", error);
                return { status: false, error: error.message || "An error occurred while processing the image.", code: 500 };
            }
        },
    }
];
