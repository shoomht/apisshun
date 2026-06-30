/**
 * Reusable multipart/form-data file-upload helper.
 *
 * The route registry in loader.js stores a single handler per route and does
 * NOT apply per-route Express middleware, so multer can't be mounted the usual
 * `app.post(route, upload.single(...), handler)` way. Instead, endpoints that
 * need a file call `receiveFile(req, res)` *inside* their `run()` — it runs
 * multer on-demand and resolves with the parsed file (or null).
 *
 * Config:
 *   MAX_UPLOAD_MB  — max accepted file size in MB (default: 15)
 *
 * Storage is in-memory (multer.memoryStorage), so handlers get `file.buffer`
 * directly — no temp files to clean up. Only image/* mimetypes are accepted;
 * anything else is rejected before the buffer is read.
 */

import multer from "multer";

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 15;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/**
 * Error type that carries an HTTP status code, so callers can map upload
 * failures to a clean response instead of a generic 500. Declared before the
 * multer instances so the fileFilter can reference it safely.
 */
export class UploadError extends Error {
  constructor(message, code = 400) {
    super(message);
    this.name = "UploadError";
    this.code = code;
  }
}

function buildUploader(maxFiles) {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: maxFiles,
    },
    fileFilter(_req, file, cb) {
      if (file.mimetype && file.mimetype.startsWith("image/")) return cb(null, true);
      // Reject with a clear, catchable error rather than silently dropping.
      cb(new UploadError("Only image uploads are accepted (image/* mimetype).", 415));
    },
  }).any();
}

const memUpload = buildUploader(1);
const memUploadMany = buildUploader(4);


/**
 * Parse a single uploaded file from a multipart request.
 *
 * Resolves with the first file (any field name is accepted) or null when the
 * request carried no file. Rejects with an UploadError (with `.code`) when the
 * upload is malformed, too large, or not an image.
 *
 *   const file = await receiveFile(req, res);
 *   if (!file) return { status: false, code: 400, error: "No file uploaded." };
 *   const buffer = file.buffer;            // Buffer
 *   const name   = file.originalname;      // string
 */
export function receiveFile(req, res) {
  return new Promise((resolve, reject) => {
    memUpload(req, res, (err) => {
      if (err) {
        if (err instanceof UploadError) return reject(err);
        // multer's own errors (e.g. LIMIT_FILE_SIZE) -> 413, others -> 400
        const tooBig = err.code === "LIMIT_FILE_SIZE";
        return reject(
          new UploadError(
            tooBig ? `File too large. Max ${MAX_UPLOAD_MB}MB.` : err.message || "Upload failed.",
            tooBig ? 413 : 400
          )
        );
      }
      const file = Array.isArray(req.files) && req.files.length > 0 ? req.files[0] : null;
      resolve(file);
    });
  });
}

export const uploadLimits = { maxMB: MAX_UPLOAD_MB, maxBytes: MAX_UPLOAD_BYTES };

/**
 * Parse multiple uploaded files from a multipart request (e.g. face-swap needs
 * a source + target image). Resolves with an array of files (possibly empty),
 * preserving field order. Rejects with an UploadError on malformed/oversized/
 * non-image uploads, same as receiveFile.
 */
export function receiveFiles(req, res) {
  return new Promise((resolve, reject) => {
    memUploadMany(req, res, (err) => {
      if (err) {
        if (err instanceof UploadError) return reject(err);
        const tooBig = err.code === "LIMIT_FILE_SIZE";
        return reject(
          new UploadError(
            tooBig ? `File too large. Max ${MAX_UPLOAD_MB}MB.` : err.message || "Upload failed.",
            tooBig ? 413 : 400
          )
        );
      }
      resolve(Array.isArray(req.files) ? req.files : []);
    });
  });
}

export default { receiveFile, receiveFiles, UploadError, uploadLimits };
