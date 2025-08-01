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

async function deleteDocumentation(req, res) {
  // Fix: parse docId from URL path instead of req.params.id because no router middleware is used
  const urlParts = req.url.split("/");
  const docId = urlParts[urlParts.length - 1];
  try {
    // We need to get event_id for the documentation before deleting it
    // So query event_id first before deleting
    const [rows] = await db.execute("SELECT event_id FROM documentation WHERE id = ?", [docId]);
    let eventId = null;
    if (rows.length > 0) {
      eventId = rows[0].event_id;
    }
    if (!eventId) {
      // If eventId not found, redirect to dashboard as fallback
      res.writeHead(302, { Location: "/dashboard" });
      res.end();
      return;
    }
    // Delete the documentation record from the database
    const sql = "DELETE FROM documentation WHERE id = ?";
    const [result] = await db.execute(sql, [docId]);
    if (result.affectedRows === 0) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Documentation not found");
      return;
    }
    res.writeHead(302, { Location: `/manage_event/${eventId}` });
    res.end();
  } catch (error) { 
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Error deleting documentation: " + error.message);
  }
}

module.exports = {
  uploadDocumentation,
  deleteDocumentation,
};
