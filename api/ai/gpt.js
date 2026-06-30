import { GptService } from '../../src/services/ai/gptService.js';

export default [
    {
        metode: "GET",
        endpoint: "/api/ai/gpt",
        name: "gpt chat",
        category: "AI",
        description: "GPT chat completion endpoint. Sends a message to a GPT-4 model and returns its response.",
        tags: ["AI", "Chatbot", "GPT"],
        example: "?prompt=hello there&system=you are a helpful assistant&temperature=0.7",
        parameters: [
            {
                name: "prompt",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 4000,
                },
                description: "User's message to the AI",
                example: "What is the capital of France?",
            },
            {
                name: "system",
                in: "query",
                required: false,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 1000,
                },
                description: "Optional system prompt to guide the AI's behavior",
                example: "You are a helpful assistant.",
            },
            {
                name: "temperature",
                in: "query",
                required: false,
                schema: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    default: 0.5,
                },
                description: "Controls randomness of the response (0 = deterministic, 1 = creative)",
                example: 0.7,
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            const { prompt, system, temperature } = req.query || {};
            if (!prompt) {
                return {
                    status: false,
                    error: "Parameter prompt is required",
                    code: 400,
                };
            }
            if (typeof prompt !== "string" || prompt.trim().length === 0) {
                return {
                    status: false,
                    error: "Parameter prompt must be a non-empty string",
                    code: 400,
                };
            }
            if (prompt.length > 4000) {
                return {
                    status: false,
                    error: "Parameter prompt must be 4000 characters or fewer",
                    code: 400,
                };
            }

            let parsedTemperature = 0.5;
            if (temperature !== undefined) {
                parsedTemperature = parseFloat(temperature);
                if (Number.isNaN(parsedTemperature) || parsedTemperature < 0 || parsedTemperature > 1) {
                    return {
                        status: false,
                        error: "Parameter temperature must be a number between 0 and 1",
                        code: 400,
                    };
                }
            }

            try {
                const result = await GptService.process(prompt.trim(), {
                    prompt: typeof system === "string" && system.trim().length > 0 ? system.trim() : null,
                    temperature: parsedTemperature,
                });
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
    },
    {
        metode: "POST",
        endpoint: "/api/ai/gpt",
        name: "gpt chat",
        category: "AI",
        description: "GPT chat completion endpoint (POST variant). Sends a message to a GPT-4 model and returns its response.",
        tags: ["AI", "Chatbot", "GPT"],
        example: '{"prompt": "hello there", "system": "you are a helpful assistant", "temperature": 0.7}',
        parameters: [
            {
                name: "prompt",
                in: "body",
                required: true,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 4000,
                },
                description: "User's message to the AI",
                example: "What is the capital of France?",
            },
            {
                name: "system",
                in: "body",
                required: false,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 1000,
                },
                description: "Optional system prompt to guide the AI's behavior",
                example: "You are a helpful assistant.",
            },
            {
                name: "temperature",
                in: "body",
                required: false,
                schema: {
                    type: "number",
                    minimum: 0,
                    maximum: 1,
                    default: 0.5,
                },
                description: "Controls randomness of the response (0 = deterministic, 1 = creative)",
                example: 0.7,
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            const { prompt, system, temperature } = req.body || {};
            if (!prompt) {
                return {
                    status: false,
                    error: "Field prompt is required in request body",
                    code: 400,
                };
            }
            if (typeof prompt !== "string" || prompt.trim().length === 0) {
                return {
                    status: false,
                    error: "Field prompt must be a non-empty string",
                    code: 400,
                };
            }
            if (prompt.length > 4000) {
                return {
                    status: false,
                    error: "Field prompt must be 4000 characters or fewer",
                    code: 400,
                };
            }

            let parsedTemperature = 0.5;
            if (temperature !== undefined) {
                parsedTemperature = parseFloat(temperature);
                if (Number.isNaN(parsedTemperature) || parsedTemperature < 0 || parsedTemperature > 1) {
                    return {
                        status: false,
                        error: "Field temperature must be a number between 0 and 1",
                        code: 400,
                    };
                }
            }

            try {
                const result = await GptService.process(prompt.trim(), {
                    prompt: typeof system === "string" && system.trim().length > 0 ? system.trim() : null,
                    temperature: parsedTemperature,
                });
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
