const path = require("path");
const fs = require("fs");
const { renderEJS } = require("../utils/renderEJS");
const guestController = require("./guestController");
const db = require("../db/connection");


async function thankyouPage(req, res) {
  const guestId = req.url.split("/thankyou/")[1];
  try {
    const guest = await guestController.getGuestById(guestId);
    const [eventRows] = await db.query(
      "SELECT * FROM events WHERE id = ?",
      [guest.event_id]
    );
    if (eventRows.length === 0) {
      res.writeHead(404);
      res.end("Event not found");
      return;
    }
    const event = eventRows[0];
    const [rundowns] = await db.query(
      "SELECT * FROM rundown WHERE event_id = ? ORDER BY jam ASC",
      [guest.event_id]
    );
    const templatePath = path.join(__dirname, "..", "views", "thankyou.ejs");
    const template = fs.readFileSync(templatePath, "utf8");
    const rendered = renderEJS(template, {
      guest,
      event,
      rundowns,
    });
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(rendered);
  } catch (error) {
    res.writeHead(500);
    res.end("Error loading thankyou page: " + error.message);
  }
}

module.exports = {
  thankyouPage,
};
