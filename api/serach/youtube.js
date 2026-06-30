import yt_search from 'yt-search';
async function youtubeSearch(query) {
    try {
        const results = await yt_search(query);
        return results.all;
    }
    catch (error) {
        throw new Error(`Error searching YouTube: ${error.message}`);
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/s/youtube",
        name: "youtube",
        category: "Search",
        description: "This API endpoint allows you to search for videos and channels on YouTube.",
        tags: ["Search", "YouTube", "Video", "Channel", "API"],
        example: "?query=sc%20bot",
        parameters: [
            {
                name: "query",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 500,
                },
                description: "Youtube query",
                example: "sc bot",
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            const { query } = req.query || {};
            if (!query) {
                return {
                    status: false,
                    error: "Parameter 'query' is required",
                    code: 400,
                };
            }
            if (typeof query !== "string" || query.trim().length === 0) {
                return {
                    status: false,
                    error: "Parameter 'query' must be a non-empty string",
                    code: 400,
                };
            }
            if (query.length > 500) {
                return {
                    status: false,
                    error: "Parameter 'query' must be less than 500 characters",
                    code: 400,
                };
            }
            try {
                const results = await youtubeSearch(query.trim());
                if (!results || results.length === 0) {
                    return {
                        status: false,
                        error: "No results found for the given query",
                        code: 404,
                    };
                }
                return {
                    status: true,
                    data: results,
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
