import multer from "multer";

// 10MB cap. Without this, multer's memoryStorage will buffer an upload of
// any size entirely in RAM before this handler ever runs — a single large
// upload (or a few concurrent ones) can exhaust available memory. Adjust
// if you genuinely need larger files, but always set *some* limit here.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export default {
  name: "File Upload",
  description: "Endpoint for uploading files via POST buffer",
  category: "Tools",
  methods: ["POST"],
  params: ["file"],
  paramsSchema: {
    file: { type: "file", required: true },
  },
  async run(req, res) {
    try {
      // call multer as a promise function
      await new Promise((resolve, reject) => {
        upload.single("file")(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }

      res.json({
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    } catch (err) {
      // Multer errors (e.g. file too large) are client input problems,
      // not server failures — give them the right status code instead of
      // a generic 500.
      if (err?.name === "MulterError") {
        const code = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(code).json({ success: false, error: err.message });
      }
      res.status(500).json({ success: false, error: err.message });
    }
  },
};