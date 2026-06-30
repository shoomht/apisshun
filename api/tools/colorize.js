import axios from 'axios';
import * as https from 'node:https';
import user_agents from 'user-agents';
import form_data from 'form-data';
import { fileTypeFromBuffer } from 'file-type';
import { Buffer } from 'buffer';
const UPLOAD = "https://kolorize.cc/api/upload";
const TICKET = "https://kolorize.cc/ticket";
const LOOKUP = "https://kolorize.cc/api/lookup";
const agent = new https.Agent({
    keepAlive: true,
    rejectUnauthorized: false,
});
const userAgent = new user_agents();
const ua = userAgent.random().toString();
let headersList = {
    "authority": "kolorize.cc",
    "accept": "*/*",
    "accept-language": "id-ID,id;q=0.9",
    "cache-control": "no-cache",
    "origin": "https://kolorize.cc",
    "pragma": "no-cache",
    "priority": "u=1, i",
    "referer": "https://kolorize.cc/",
    "sec-ch-ua": '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent": ua,
};
const createImageResponse = (buffer, filename = null) => {
    const headers = {
        "Content-Type": "image/webp",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
    };
    if (filename) {
        headers["Content-Disposition"] = `inline; filename="${filename}"`;
    }
    return { buffer, headers };
};
async function _req({ url, method = "GET", data = null, params = null, head = null, response = "json" }) {
    try {
        let headers = {};
        let param;
        let datas;
        if (head && (head == "original" || head == "ori")) {
            const uri = new URL(url);
            headers = {
                authority: uri.hostname,
                origin: "https://" + uri.hostname,
                "Cache-Control": "no-cache",
                "user-agent": ua,
            };
        }
        else if (head && typeof head == "object") {
            headers = head;
        }
        if (params && typeof params == "object") {
            param = params;
        }
        else {
            param = "";
        }
        if (data) {
            datas = data;
        }
        else {
            datas = "";
        }
        const options = {
            url: url,
            method: method,
            headers,
            timeout: 30_000,
            responseType: response,
            httpsAgent: agent,
            withCredentials: true,
            validateStatus: (status) => {
                return status <= 500;
            },
            ...(!datas ? {} : { data: datas }),
            ...(!params ? {} : { params: param }),
        };
        const res = await axios.request(options);
        if (res.headers["set-cookie"]) {
            res.headers["set-cookie"].forEach((v) => {
                if (head && typeof head === "object") {
                    head["cookie"] = v.split(";")[0];
                }
            });
        }
        return res;
    }
    catch (error) {
        console.error(error);
        throw error;
    }
}
async function _upload(buffer, fileName = "image.jpg") {
    const form = new form_data();
    form.append("files", buffer, {
        filename: fileName,
        contentType: "image/jpeg",
    });
    const res = await _req({
        url: UPLOAD,
        method: "POST",
        data: form,
        head: {
            ...headersList,
            ...form.getHeaders(),
        },
    });
    return res.data;
}
async function _getTicket(data, prompt) {
    const payload = {
        "type": "colorize_v2",
        "fnKey": data.results[0].sourceKey,
        "w": data.results[0].w,
        "h": data.results[0].h,
        "prompt": prompt,
        "tries": 0,
        "seq": 0,
        "dpi": data.results[0].dpi,
    };
    const res = await _req({
        url: TICKET,
        method: "POST",
        data: payload,
        head: headersList,
    });
    return res.data;
}
async function _lookup(id) {
    const payload = {
        "keyOrUrl": id,
        "mode": 3,
        "r": 1.5,
        "forceH": 0,
    };
    let res = await _req({
        url: LOOKUP,
        method: "POST",
        data: payload,
        head: headersList,
    });
    return res.data;
}
function _task(ticket) {
    let results = [];
    return new Promise(async (resolve, reject) => {
        try {
            const res = await _req({
                url: TICKET,
                method: "GET",
                params: {
                    ticket,
                },
                response: "stream",
                head: headersList,
            });
            res.data.on("data", (data) => {
                results.push(data.toString());
            });
            res.data.on("end", () => {
                resolve(results.pop());
            });
            res.data.on("error", (error) => {
                reject(error);
            });
        }
        catch (error) {
            reject(error);
        }
    });
}
async function ColorizeImageFromUrl(imageUrl, prompt) {
    const kb = await _req({
        url: imageUrl,
        method: "GET",
        response: "arraybuffer",
        head: "ori",
    });
    const buffer = Buffer.from(kb.data);
    const fileType = await fileTypeFromBuffer(buffer);
    if (!fileType || !fileType.mime.startsWith("image/")) {
        throw new Error("Unsupported file type, only images are allowed.");
    }
    const fileName = `image.${fileType.ext}`;
    const upload = await _upload(buffer, fileName);
    const ticket = await _getTicket(upload, prompt);
    const task = await _task(ticket.ticket);
    const jTask = JSON.parse(task);
    const lookup2 = await _lookup(jTask.outputKey);
    if (!lookup2 || !lookup2.imgUrl) {
        throw new Error("Failed to get result image URL.");
    }
    return {
        prompt: jTask.prompt,
        outputKey: jTask.outputKey,
        buffer: Buffer.from(lookup2.imgUrl.replace("data:image/webp;base64,", ""), "base64"),
    };
}
async function ColorizeImageFromFile(imageBuffer, prompt, fileName = "image.jpg") {
    const fileType = await fileTypeFromBuffer(imageBuffer);
    if (!fileType || !fileType.mime.startsWith("image/")) {
        throw new Error("Unsupported file type, only images are allowed.");
    }
    const finalFileName = fileName || `image.${fileType.ext}`;
    const upload = await _upload(imageBuffer, finalFileName);
    const ticket = await _getTicket(upload, prompt);
    const task = await _task(ticket.ticket);
    const jTask = JSON.parse(task);
    const lookup2 = await _lookup(jTask.outputKey);
    if (!lookup2 || !lookup2.imgUrl) {
        throw new Error("Failed to get result image URL.");
    }
    return {
        prompt: jTask.prompt,
        outputKey: jTask.outputKey,
        buffer: Buffer.from(lookup2.imgUrl.replace("data:image/webp;base64,", ""), "base64"),
    };
}
export default [
    {
        metode: "GET",
        endpoint: "/api/tools/colorize",
        name: "colorize",
        category: "Tools",
        description: "This API endpoint colorizes a grayscale image using a provided URL.",
        tags: ["TOOLS", "IMAGE", "COLORIZE", "PHOTO-EDITING"],
        example: "?url=https://files.catbox.moe/258vhm.jpg",
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
                description: "The URL of the grayscale image to colorize.",
                example: "https://files.catbox.moe/258vhm.jpg",
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req, res }) {
            const { url } = req.query || {};
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
            try {
                new URL(url.trim());
                const result = await ColorizeImageFromUrl(url.trim(), "colorize image");
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
