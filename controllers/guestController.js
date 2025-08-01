const fs = require("fs");
const path = require("path");
const db = require("../db/connection");

const formidable = require("formidable");

async function addGuest(req, res) {
  const eventId = req.url.split("/")[2];
  const form = new formidable.IncomingForm({ multiples: false, uploadDir: path.join(__dirname, "..", "uploads"), keepExtensions: true });
  form.parse(req, async (err, fields, files) => {
    if (err) {
      res.writeHead(500);
      return res.end("Error parsing form data: " + err.message);
    }
    try {
      let { name, email, phone, photo } = fields;
      if (Array.isArray(name)) name = name[0];
      if (Array.isArray(email)) email = email[0];
      if (Array.isArray(phone)) phone = phone[0];
      if (Array.isArray(photo)) photo = photo[0];
      let photoUrl = null;

      if (photo && photo.startsWith("data:image")) {
        // Decode base64 image and save to file
        const base64Data = photo.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const filename = `guest_photo_${Date.now()}.png`;
        const filepath = path.join(__dirname, "..", "uploads", filename);
        await fs.promises.writeFile(filepath, buffer);
        photoUrl = `/uploads/${filename}`;
      } else if (files.photo && files.photo.size > 0) {
        const file = files.photo;
        const filename = path.basename(file.path);
        photoUrl = `/uploads/${filename}`;
      }

      const sql =
        "INSERT INTO guests (event_id, name, email, phone, photo_url) VALUES (?, ?, ?, ?, ?)";
      await db.execute(sql, [eventId, name, email, phone, photoUrl]);
      res.writeHead(302, { Location: `/manage_event/${eventId}` });
      res.end();
    } catch (error) {
      res.writeHead(500);
      res.end("Error adding guest: " + error.message);
    }
  });
}

async function deleteGuest(req, res) {
  const guestId = req.url.split("/")[2];
  try {
    // Get event_id for redirect
    const [rows] = await db.query(
      "SELECT event_id FROM guests WHERE id = ?",
      [guestId]
    );
    if (rows.length === 0) {
      res.writeHead(404);
      return res.end("Guest not found");
    }
    const eventId = rows[0].event_id;
    await db.execute("DELETE FROM guests WHERE id = ?", [guestId]);
    res.writeHead(302, { Location: `/manage_event/${eventId}` });
    res.end();
  } catch (error) {
    res.writeHead(500);
    res.end("Error deleting guest: " + error.message);
  }
}

async function getGuestById(guestId) {
  const [rows] = await require("../db/connection").query(
    "SELECT * FROM guests WHERE id = ?",
    [guestId]
  );
  if (rows.length === 0) {
    throw new Error("Guest not found");
  }
  return rows[0];
}

module.exports = {
  addGuest,
  deleteGuest,
  getGuestById,
};
