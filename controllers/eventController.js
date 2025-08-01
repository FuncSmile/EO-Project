const fs = require("fs");
const path = require("path");
const ejs = require("ejs");
const db = require("../db/connection");
const { renderEJS } = require("../utils/renderEJS");

async function dashboard(req, res) {
  try {
    const data = await db.query(
      "SELECT * FROM events ORDER BY date DESC, time DESC"
    );
    const events = data[0];
    fs.readFile(
      path.join(__dirname, "..", "views", "dashboard.ejs"),
      "utf8",
      (err, template) => {
        if (err) {
          res.writeHead(500);
          return res.end("Error loading dashboard.ejs");
        }
        // Render EJS template manually with events data
        let rendered = template.replace(/<%= title %>/g, "Dashboard");
        // Insert events HTML into placeholder <!--EVENTS_PLACEHOLDER-->
        const eventsHtml = events
          .map((event) => {
            const dateObj = new Date(event.date);
            const formattedDate = dateObj.toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const timeObj = new Date(`1970-01-01T${event.time}`);
            const formattedTime = timeObj.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return `
          <div class="flex flex-col gap-2 w-[100%] h-max bg-white p-4 rounded-lg shadow-md relative">
            <h1 class="text-2xl font-extrabold tracking-wide drop-shadow-lg uppercase text truncate w-[90%]">${event.name}</h1>
            <p class="text-base drop-shadow-md">${event.location}</p>
            <p class="text-lg font-semibold drop-shadow-md">${formattedDate} ${formattedTime}</p>
            <p class="text-sm opacity-80 drop-shadow-md">${event.description}</p>
            <div class="absolute top-4 right-4">
              <div class="relative inline-block text-left">
                <button id="menu-button-${event.id}" type="button" class="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-2 py-1 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none" aria-expanded="true" aria-haspopup="true" onclick="document.getElementById('dropdown-${event.id}').classList.toggle('hidden')">
                  &#x22EE;
                </button>
                <div id="dropdown-${event.id}" class="hidden origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                  <div class="py-1" role="menu" aria-orientation="vertical" aria-labelledby="menu-button-${event.id}">
                    <a href="/see_event/${event.id}" class="block px-4 py-2 text-sm text-blue-500 hover:bg-gray-100" role="menuitem">Lihat</a>
                    <a href="/manage_event/${event.id}" class="block px-4 py-2 text-sm text-amber-500 hover:bg-gray-100" role="menuitem">Kelola Acara</a>
                    <a href="/rundown_list/${event.id}" class="block px-4 py-2 text-sm text-green-500 hover:bg-gray-100" role="menuitem">Daftar Roundown</a>
                    <a href="/edit_event/${event.id}" class="block px-4 py-2 text-sm text-blue-500 hover:bg-gray-100" role="menuitem">Edit</a>
                    <a href="/delete_event/${event.id}" class="block px-4 py-2 text-sm text-red-500 hover:bg-gray-100" role="menuitem">Hapus</a>
                    </div>
                </div>
              </div>
            </div>
          </div>
        `;
          })
          .join("");
        rendered = rendered.replace("<!--EVENTS_PLACEHOLDER-->", eventsHtml);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(rendered);
      }
    );
  } catch (error) {
    res.writeHead(500);
    res.end("Error loading events: " + error.message);
  }
}

function membersPage(req, res) {
  const fs = require("fs");
  const path = require("path");

  fs.readFile(
    path.join(__dirname, "..", "views", "member.ejs"),
    "utf8",
    (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end("Error loading index.ejs");
      }
      const rendered = renderEJS(data, { title: "Event Management" });
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(rendered);
    }
  );
}

function addEventPage(req, res) {
  const fs = require("fs");
  const path = require("path");

  fs.readFile(
    path.join(__dirname, "..", "views", "addEvent.ejs"),
    "utf8",
    (err, data) => {
      if (err) {
        res.writeHead(500);
        return res.end("Error loading addEvent.ejs");
      }
      const rendered = renderEJS(data, { title: "Add New Event" });
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(rendered);
    }
  );
}

async function addEvent(req, res) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    const querystring = require("querystring");
    const formData = querystring.parse(body);
    const { nama, alamat, waktuAcara, jamAcara, description } = formData;
    try {
      const sql =
        "INSERT INTO events (name, location, date, time, description) VALUES (?, ?, ?, ?, ?)";
      await db.execute(sql, [nama, alamat, waktuAcara, jamAcara, description]);
      res.writeHead(302, { Location: "/dashboard" });
      res.end();
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(
        `<h1>Database Error</h1><p>${error.message}</p><a href="/add_event">Back to form</a>`
      );
    }
  });
}

async function deleteEvent(req, res) {
  const eventId = req.url.split("/")[2];
  try {
    await db.execute("DELETE FROM events WHERE id = ?", [eventId]);
    res.writeHead(302, { Location: "/dashboard" });
    res.end();
  } catch (error) {
    res.writeHead(500);
    res.end("Error deleting event: " + error.message);
  }
}

async function editEventPage(req, res) {
  const eventId = req.url.split("/")[2];
  try {
    const [rows] = await db.query("SELECT * FROM events WHERE id = ?", [eventId]);
    if (rows.length === 0) {
      res.writeHead(404);
      return res.end("Event not found");
    }
    const event = rows[0];
    const fs = require("fs");
    const path = require("path");
    const data = await new Promise((resolve, reject) => {
      fs.readFile(
        path.join(__dirname, "..", "views", "editEvent.ejs"),
        "utf8",
        (err, data) => {
          if (err) reject(err);
          else resolve(data);
        }
      );
    });
    const rendered = ejs.render(data, { title: "Edit Event", event });
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(rendered);
  } catch (error) {
    res.writeHead(500);
    res.end("Error loading event: " + error.message);
  }
}

async function editEvent(req, res) {
  const eventId = req.url.split("/")[2];
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", async () => {
    const querystring = require("querystring");
    const formData = querystring.parse(body);
    const { nama, alamat, waktuAcara, jamAcara, description } = formData;
    try {
      const sql =
        "UPDATE events SET name = ?, location = ?, date = ?, time = ?, description = ? WHERE id = ?";
      await db.execute(sql, [
        nama,
        alamat,
        waktuAcara,
        jamAcara,
        description,
        eventId,
      ]);
      res.writeHead(302, { Location: "/dashboard" });
      res.end();
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(
        `<h1>Database Error</h1><p>${error.message}</p><a href="/edit_event/${eventId}">Back to form</a>`
      );
    }
  });
}

async function seeEvent(req, res) {
  const eventId = req.url.split("/")[2];
  try {
    const [rows] = await db.query("SELECT * FROM events WHERE id = ?", [eventId]);
    if (rows.length === 0) {
      res.writeHead(404);
      return res.end("Event not found");
    }
    const event = rows[0];
    const [guestRows] = await db.query(
      "SELECT * FROM guests WHERE event_id = ?",
      [eventId]
    );
    const [docRows] = await db.query(
      "SELECT * FROM documentation WHERE event_id = ?",
      [eventId]
    );
    const fs = require("fs");
    const path = require("path");
    const data = await new Promise((resolve, reject) => {
      fs.readFile(
        path.join(__dirname, "..", "views", "lihatEvent.ejs"),
        "utf8",
        (err, data) => {
          if (err) reject(err);
          else resolve(data);
        }
      );
    });
    const rendered = ejs.render(data, {
      title: "Detail Event",
      event,
      guests: guestRows,
      documentation: docRows,
    });
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(rendered);
  } catch (error) {
    res.writeHead(500);
    res.end("Error loading event: " + error.message);
  }
}

async function manageEvent(req, res) {
  const eventId = req.url.split("/")[2];
  try {
    const [eventRows] = await db.query("SELECT * FROM events WHERE id = ?", [
      eventId,
    ]);
    if (eventRows.length === 0) {
      res.writeHead(404);
      return res.end("Event not found");
    }
    const event = eventRows[0];
    const [guestRows] = await db.query(
      "SELECT * FROM guests WHERE event_id = ?",
      [eventId]
    );
    const [docRows] = await db.query(
      "SELECT * FROM documentation WHERE event_id = ?",
      [eventId]
    );
    const fs = require("fs");
    const path = require("path");
    const data = await new Promise((resolve, reject) => {
      fs.readFile(
        path.join(__dirname, "..", "views", "manageEvent.ejs"),
        "utf8",
        (err, data) => {
          if (err) reject(err);
          else resolve(data);
        }
      );
    });
    const rendered = ejs.render(data, {
      title: "Kelola Acara",
      event,
      guests: guestRows,
      documentation: docRows,
    });
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(rendered);
  } catch (error) {
    res.writeHead(500);
    res.end("Error loading manage event: " + error.message);
  }
}

async function eventList(req, res) {
  const eventId = req.url.split("/")[2];
  try {
    const [rows] = await db.query("SELECT * FROM events WHERE id = ?", [eventId]);
    if (rows.length === 0) {
      res.writeHead(404);
      return res.end("Event not found");
    }
    const event = rows[0];
    const fs = require("fs");
    const path = require("path");
    const data = await new Promise((resolve, reject) => {
      fs.readFile(
        path.join(__dirname, "..", "views", "eventList.ejs"),
        "utf8",
        (err, data) => {
          if (err) reject(err);
          else resolve(data);
        }
      );
    });
    const rendered = ejs.render(data, { title: "Event List", event });
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(rendered);
  } catch (error) {
    res.writeHead(500);
    res.end("Error loading event list: " + error.message);
  }
}

async function documentationPage(req, res) {
  const eventId = req.url.split("/")[2];
  try {
    const [eventRows] = await db.query("SELECT * FROM events WHERE id = ?", [
      eventId,
    ]);
    if (eventRows.length === 0) {
      res.writeHead(404);
      return res.end("Event not found");
    }
    const event = eventRows[0];
    const [docRows] = await db.query(
      "SELECT * FROM documentation WHERE event_id = ?",
      [eventId]
    );
    const fs = require("fs");
    const path = require("path");
    const data = await new Promise((resolve, reject) => {
      fs.readFile(
        path.join(__dirname, "..", "views", "documentationPage.ejs"),
        "utf8",
        (err, data) => {
          if (err) reject(err);
          else resolve(data);
        }
      );
    });
    const rendered = ejs.render(data, {
      title: "Dokumentasi Acara",
      event,
      documentation: docRows,
    });
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(rendered);
  } catch (error) {
    res.writeHead(500);
    res.end("Error loading documentation page: " + error.message);
  }
}

module.exports = {
  dashboard,
  membersPage,
  addEventPage,
  addEvent,
  deleteEvent,
  editEventPage,
  editEvent,
  seeEvent,
  manageEvent,
  eventList,
  documentationPage,
};
