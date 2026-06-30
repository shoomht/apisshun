import { generateIQC } from 'iqc-canvas';
import { Buffer } from 'buffer';

/**
 * Generates an IQC-style image (phone status-bar styled quote card) from
 * text using the iqc-canvas package.
 *
 * NOTE: the exact shape of generateIQC()'s return value wasn't confirmed
 * against the package's actual README/source (only a usage snippet was
 * available), so this handles the two most likely shapes defensively:
 *   1. A Buffer / Uint8Array returned directly.
 *   2. An object containing the image under a common key (buffer/data/image).
 * If iqc-canvas returns something else, this will surface a clear 500
 * error rather than silently sending garbage bytes.
 */
async function generateIQCImage(text, time, options) {
    try {
        const result = await generateIQC(text, time, options);
        if (Buffer.isBuffer(result) || result instanceof Uint8Array) {
            return Buffer.from(result);
        }
        if (result && typeof result === "object") {
            const candidate = result.buffer || result.data || result.image || result.result;
            if (Buffer.isBuffer(candidate) || candidate instanceof Uint8Array) {
                return Buffer.from(candidate);
            }
        }
        throw new Error("Unrecognized return format from generateIQC — expected a Buffer");
    }
    catch (error) {
        console.error("iqc-canvas generation error:", error.message);
        throw new Error(error.message || "Failed to generate IQC image");
    }
}

export default [
    {
        metode: "GET",
        endpoint: "/api/m/iqc",
        name: "iqc generator",
        category: "Maker",
        description: "Generates an IQC-style phone status-bar quote card image from text using iqc-canvas.",
        tags: ["MAKER", "IMAGE", "IQC", "CANVAS"],
        example: "?text=Hello World&time=00.00&baterai=100&operator=true&timebar=true&wifi=true",
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
                description: "The quote text to render",
                example: "Hello World",
            },
            {
                name: "time",
                in: "query",
                required: false,
                schema: {
                    type: "string",
                    default: "00.00",
                },
                description: "Time shown in the status bar, format HH.MM",
                example: "00.00",
            },
            {
                name: "baterai",
                in: "query",
                required: false,
                schema: {
                    type: "string",
                    default: "100",
                },
                description: "Battery percentage shown in the status bar (omit or empty to hide the battery indicator)",
                example: "100",
            },
            {
                name: "operator",
                in: "query",
                required: false,
                schema: {
                    type: "boolean",
                    default: true,
                },
                description: "Whether to show the operator/signal icon",
                example: true,
            },
            {
                name: "timebar",
                in: "query",
                required: false,
                schema: {
                    type: "boolean",
                    default: true,
                },
                description: "Whether to show the status bar (time/icons row)",
                example: true,
            },
            {
                name: "wifi",
                in: "query",
                required: false,
                schema: {
                    type: "boolean",
                    default: true,
                },
                description: "Whether to show the WiFi icon",
                example: true,
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req, res }) {
            const {
                text,
                time = "00.00",
                baterai = "100",
                operator = "true",
                timebar = "true",
                wifi = "true",
            } = req.query || {};

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

            const toBool = (v) => String(v).toLowerCase() === "true";
            const showBaterai = baterai !== "" && baterai !== undefined && baterai !== null;

            const options = {
                baterai: [showBaterai, String(baterai)],
                operator: toBool(operator),
                timebar: toBool(timebar),
                wifi: toBool(wifi),
            };

            try {
                const buffer = await generateIQCImage(text.trim(), String(time), options);
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
