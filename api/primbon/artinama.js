import axios from 'axios';
import * as cheerio from 'cheerio';
async function scrape(nama) {
    try {
        const response = await axios.get(`https://primbon.com/arti_nama.php?nama1=${nama}&proses=+Submit%21+`, {
            timeout: 30000,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            },
        });
        const $ = cheerio.load(response.data);
        const fetchText = $("#body").text();
        let hasil;
        try {
            hasil = {
                nama,
                arti: fetchText.split("memiliki arti: ")[1].split("Nama:")[0].trim(),
                catatan: "Gunakan juga aplikasi numerologi Kecocokan Nama, untuk melihat sejauh mana keselarasan nama anda dengan diri anda.",
            };
        }
        catch (e) {
            hasil = {
                status: false,
                message: `Tidak ditemukan arti nama "${nama}". Cari dengan kata kunci yang lain.`,
            };
        }
        return hasil;
    }
    catch (error) {
        console.error("API Error:", error.message);
        throw new Error("Failed to get response from API");
    }
}
export default [
    {
        metode: "GET",
        endpoint: "/api/primbon/artinama",
        name: "arti nama",
        category: "Primbon",
        description: "This API endpoint allows users to retrieve the meaning of a given name from Primbon.",
        tags: ["Primbon", "Name Meaning", "Culture"],
        example: "?nama=putu",
        parameters: [
            {
                name: "nama",
                in: "query",
                required: true,
                schema: {
                    type: "string",
                    minLength: 1,
                    maxLength: 100,
                },
                description: "The name to search for.",
                example: "putu",
            },
        ],
        isPremium: false,
        isMaintenance: false,
        isPublic: true,
        async run({ req }) {
            const { nama } = req.query || {};
            if (!nama) {
                return {
                    status: false,
                    error: "Parameter 'nama' is required",
                    code: 400,
                };
            }
            if (typeof nama !== "string" || nama.trim().length === 0) {
                return {
                    status: false,
                    error: "Parameter 'nama' must be a non-empty string",
                    code: 400,
                };
            }
            try {
                const result = await scrape(nama.trim());
                if (!result) {
                    return {
                        status: false,
                        error: "No result returned from API",
                        code: 500,
                    };
                }
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
