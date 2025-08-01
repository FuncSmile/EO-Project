const fs = require("fs");
const path = require("path");
const db = require("../db/connection");

const formidable = require("formidable");

async function uploadDocumentation(req, res) {
  const eventId = req.url.split("/")[2];
  const form = new formidable.IncomingForm({ multiples: false, uploadDir: path.join(__dirname, "..", "uploads"), keepExtensions: true });
  form.parse(req, async (err, fields, files) => {
    console.log("Files received:", files);
    if (err) {
      res.writeHead(500);
      return res.end("Error parsing form data: " + err.message);
    }
    try {
      if (!files.documentation || files.documentation.size === 0) {
        res.writeHead(400);
        return res.end("No documentation file uploaded");
      }
      let file = files.documentation;
      console.log("File object:", file);
      if (Array.isArray(file)) {
        file = file[0];
      }
      const filename = path.basename(file.filepath || file.filePath || file.path);
      const file_url = `/uploads/${filename}`;
      const file_type = file.mimetype || file.type || "application/octet-stream";
      const sql =
        "INSERT INTO documentation (event_id, file_url, file_type) VALUES (?, ?, ?)";
      await db.execute(sql, [eventId, file_url, file_type]);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      res.writeHead(500);
      res.end("Error saving documentation: " + error.message);
    }
  });
}

module.exports = {
  uploadDocumentation,
};
