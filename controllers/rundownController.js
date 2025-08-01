const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const db = require("../db/connection");
const querystring = require("querystring");
const { clearScheduledJobs, scheduleRundownReminders } = require("../whatsappReminder");
const { renderEJS } = require("../utils/renderEJS");

async function rundownList(req, res) {
  const eventId = req.url.split("/")[2];
  try {
    const [rundowns] = await db.query(
      "SELECT * FROM rundown WHERE event_id = ? ORDER BY jam ASC",
      [eventId]
    );
    const [events] = await db.query("SELECT * FROM events WHERE id = ?", [
      eventId,
    ]);
    if (events.length === 0) {
      res.writeHead(404);
      return res.end("Event not found");
    }
    const event = events[0];
    fs.readFile(
      path.join(__dirname, "..", "views", "rundownList.ejs"),
      "utf8",
      (err, data) => {
        if (err) {
          res.writeHead(500);
          return res.end("Error loading rundownList.ejs");
        }
        const rendered = ejs.render(data, {
          title: "Rundown List",
          event,
          rundowns,
        });
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(rendered);
      }
    );
  } catch (error) {
    res.writeHead(500);
    res.end("Error loading rundown list: " + error.message);
  }
}

async function addRundown(req, res) {
  const eventId = req.url.split("/")[2];
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    try {
      const formData = querystring.parse(body);
      const { kegiatan, tempat, jam, pembawa_acara } = formData;
      const sql =
        "INSERT INTO rundown (event_id, kegiatan, tempat, jam, pembawa_acara) VALUES (?, ?, ?, ?, ?)";
      await db.execute(sql, [eventId, kegiatan, tempat, jam, pembawa_acara]);
      // Reset and reschedule reminders after adding rundown
      clearScheduledJobs();
      await scheduleRundownReminders();
      res.writeHead(302, { Location: `/rundown_list/${eventId}` });
      res.end();
    } catch (error) {
      res.writeHead(500);
      res.end("Error adding rundown: " + error.message);
    }
  });
}

async function editRundownPage(req, res) {
  const rundownId = req.url.split("/")[2];
  try {
    const [rows] = await db.query("SELECT * FROM rundown WHERE id = ?", [
      rundownId,
    ]);
    if (rows.length === 0) {
      res.writeHead(404);
      return res.end("Event not found");
    }
    const rundown = rows[0];
    fs.readFile(
      path.join(__dirname, "..", "views", "editRundown.ejs"),
      "utf8",
      (err, data) => {
        if (err) {
          res.writeHead(500);
          return res.end("Error loading editRundown.ejs");
        }
        const rendered = ejs.render(data, { title: "Edit rundown", rundown });
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(rendered);
      }
    );
  } catch (error) {
    res.writeHead(500);
    res.end("Error loading rundown: " + error.message);
  }
}

async function editRundown(req, res) {
  const rundownId = req.url.split("/")[2];
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    try {
      const formData = querystring.parse(body);
      const { kegiatan, tempat, jam, pembawa_acara } = formData;
      await db.execute(
        "UPDATE rundown SET kegiatan=?, tempat=?, jam=?, pembawa_acara=? WHERE id=?",
        [kegiatan, tempat, jam, pembawa_acara, rundownId]
      );
      const [rows] = await db.query("SELECT event_id FROM rundown WHERE id=?", [
        rundownId,
      ]);
      const eventId = rows[0].event_id;
      res.writeHead(302, { Location: `/rundown_list/${eventId}` });
      res.end();
    } catch (error) {
      res.writeHead(500);
      res.end("Error editing rundown: " + error.message);
    }
  });
}

async function deleteRundown(req, res) {
  const rundownId = req.url.split("/")[2];
  try {
    const [rows] = await db.query(
      "SELECT event_id FROM rundown WHERE id=?",
      [rundownId]
    );
    const eventId = rows[0].event_id;
    await db.execute("DELETE FROM rundown WHERE id=?", [rundownId]);
    res.writeHead(302, { Location: `/rundown_list/${eventId}` });
    res.end();
  } catch (error) {
    res.writeHead(500);
    res.end("Error deleting rundown: " + error.message);
  }
}

async function sendRundownReminders(req, res) {
  const eventId = req.url.split("/")[2];
  try {
    await clearScheduledJobs();
    await scheduleRundownReminders(eventId);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true }));
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ success: false, message: error.message }));
  }
}

module.exports = {
  rundownList,
  addRundown,
  editRundownPage,
  editRundown,
  deleteRundown,
  sendRundownReminders,
};
