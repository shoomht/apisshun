import axios from 'axios';
import * as cheerio from 'cheerio';
async function scrapeJadwalTV(channel) {
    const baseUrl = "https://www.jadwaltv.net";
    const jadwalTVNowUrl = `${baseUrl}/channel/acara-tv-nasional-saat-ini`;
    const jadwalChannelUrl = `${baseUrl}/channel/${channel}`;
    try {
        let url;
        if (!channel) {
            url = jadwalTVNowUrl;
        }
        else {
            url = jadwalChannelUrl.toLowerCase();
        }
        const { data } = await axios.get(url, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        const $ = cheerio.load(data);
        if (!channel) {
            const jadwal = [];
            let currentChannel = "";
            $("table.table-bordered tbody tr").each((index, element) => {
                const isChannelRow = $(element).find("td[colspan=2]").length > 0;
                if (isChannelRow) {
                    currentChannel = $(element).find("a").text().trim();
                }
                else {
                    const jam = $(element).find("td").first().text().trim();
                    const acara = $(element).find("td").last().text().trim();
                    if (jam && acara && currentChannel) {
                        const existingChannel = jadwal.find((j) => j.channel === currentChannel);
                        if (existingChannel) {
                            existingChannel.jadwal.push({ jam, acara });
                        }
                        else {
                            jadwal.push({
                                channel: currentChannel,
                                jadwal: [{ jam, acara }],
                            });
                        }
                    }
                }
            });
            return { status: true, data: jadwal };
        }
        else {
            const jadwal = [];
            $("table.table-bordered tbody tr").each((index, element) => {
                const jam = $(element).find("td").first().text().trim();
                const acara = $(element).find("td").last().text().trim();
                if (jam && acara && jam !== "Jam" && acara !== "Acara") {
                    jadwal.push({ jam, acara });
                }
            });
            return { status: true, data: jadwal };
        }
    }
    catch (error) {
        console.error("Error during scraping:", error.message);
        return { status: false, error: error.message };
    }
}
async function getTVChannels() {
    const url = "https://www.jadwaltv.net/";
    try {
        const { data } = await axios.get(url, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        const $ = cheerio.load(data);
        const channels = [];
        $(".table-bordered tbody tr td a").each((_, element) => {
            const channel = $(element).text().trim();
            const url = $(element).attr("href")?.split("/").pop();
            if (channel && url) {
                channels.push({ channel, url });
            }
        });
        return { status: true, data: channels };
    }
    catch (error) {
        console.error("Error fetching channels:", error.message);
        return { status: false, error: error.message };
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/info/jadwaltv",
        name: "jadwalTV",
        category: "Info",
        description: "This API endpoint allows you to retrieve the current TV schedule for various national channels in Indonesia.",
        tags: ["Info", "TV", "Schedule"],
        example: "?channel=sctv",
        parameters: [
            {
                name: "channel",
                in: "query",
                required: false,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 50,
                },
                description: "The name of the TV channel to get the schedule for (e.g., sctv).",
                example: "sctv",
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            const { channel } = req.query || {};
            if (channel && typeof channel !== "string") {
                return {
                    status: false,
                    error: "Channel parameter must be a string",
                    code: 400,
                };
            }
            if (channel && channel.trim().length === 0) {
                return {
                    status: false,
                    error: "Channel parameter cannot be empty",
                    code: 400,
                };
            }
            if (channel && channel.length > 50) {
                return {
                    status: false,
                    error: "Channel parameter must be less than 50 characters",
                    code: 400,
                };
            }
            try {
                const result = await scrapeJadwalTV(channel);
                if (!result.status) {
                    return {
                        status: false,
                        error: result.error || "Failed to retrieve TV schedule",
                        code: 500,
                    };
                }
                return {
                    status: true,
                    data: result.data,
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
