const http = require("http");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");
const formidable = require("formidable");
const db = require("./db/connection");
const ejs = require("ejs");
const {
  scheduleRundownReminders,
  clearScheduledJobs,
  client,
} = require("./whatsappReminder");
const QRCode = require("qrcode");

// Setup upload directory
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

let latestQRImage = null;

// Listen to QR event and generate base64 image
client.on("qr", async (qr) => {
  console.log("QR RECEIVED", qr);
  try {
    latestQRImage = await QRCode.toDataURL(qr);
  } catch (err) {
    console.error("Error generating QR code image:", err);
  }
});

const server = http.createServer((req, res) => {
  // Routing /
  if (req.method === "GET" && req.url === "/") {
    fs.readFile(
      path.join(__dirname, "views", "index.ejs"),
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
  } else if (req.method === "GET" && req.url === "/whatsapp_qr") {
    // Serve QR code image as base64
    if (latestQRImage) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ qrImage: latestQRImage }));
    } else {
      res.writeHead(504);
      res.end(JSON.stringify({ error: "QR code not available" }));
    }
  } else if (req.method === "GET" && req.url === "/whatsapp_qr_page") {
    // Serve the QR code page
    fs.readFile(
      path.join(__dirname, "views", "whatsappQR.ejs"),
      "utf8",
      (err, data) => {
        if (err) {
          res.writeHead(500);
          return res.end("Error loading WhatsApp QR page");
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
      }
    );
  } else if (req.method === "POST" && req.url === "/login") {
    // Keep this for fallback or remove if not needed
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const formData = querystring.parse(body);
      const dummyData = {
        username: "ADMIN",
        password: "ADMIN123",
      };

      if (
        formData.username === dummyData.username &&
        formData.password === dummyData.password
      ) {
        // Redirect to dashboard directly (fallback)
        res.writeHead(302, { Location: "/dashboard" });
        res.end();
      } else {
        res.writeHead(401, { "Content-Type": "text/html" });
        return res.end(
          `<h1>Login failed!</h1><p>Invalid username or password.</p><a href="/login">Try again</a>`
        );
      }
    });
  } else if (req.method === "POST" && req.url === "/api/login") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const formData = querystring.parse(body);
      const dummyData = {
        username: "ADMIN",
        password: "ADMIN123",
      };

      if (
        formData.username === dummyData.username &&
        formData.password === dummyData.password
      ) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            message: "Invalid username or password",
          })
        );
      }
    });
  } else if (req.method === "GET" && req.url === "/login") {
    fs.readFile(
      path.join(__dirname, "views", "login.ejs"),
      "utf8",
      (err, data) => {
        if (err) {
          res.writeHead(500);
          return res.end("Error loading login.ejs");
        }
        const rendered = renderEJS(data, { title: "Login" });
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(rendered);
      }
    );
  } else if (req.method === "GET" && req.url.startsWith("/dashboard")) {
    (async () => {
      try {
        const data = await db.query(
          "SELECT * FROM events ORDER BY date DESC, time DESC"
        );
        const events = data[0];
        fs.readFile(
          path.join(__dirname, "views", "dashboard.ejs"),
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
            rendered = rendered.replace(
              "<!--EVENTS_PLACEHOLDER-->",
              eventsHtml
            );
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(rendered);
          }
        );
      } catch (error) {
        res.writeHead(500);
        res.end("Error loading events: " + error.message);
      }
    })();
  } else if (req.method === "GET" && req.url === "/members") {
    fs.readFile(
      path.join(__dirname, "views", "member.ejs"),
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
  } else if (req.method === "GET" && req.url.startsWith("/see_event/")) {
    const eventId = req.url.split("/")[2];
    (async () => {
      try {
        const [rows] = await db.query("SELECT * FROM events WHERE id = ?", [
          eventId,
        ]);
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
        fs.readFile(
          path.join(__dirname, "views", "lihatEvent.ejs"),
          "utf8",
          (err, data) => {
            if (err) {
              res.writeHead(500);
              return res.end("Error loading lihatEvent.ejs");
            }
            const rendered = ejs.render(data, {
              title: "Detail Event",
              event,
              guests: guestRows,
              documentation: docRows,
            });
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(rendered);
          }
        );
      } catch (error) {
        res.writeHead(500);
        res.end("Error loading event: " + error.message);
      }
    })();
  } else if (req.method === "GET" && req.url === "/add_event") {
    fs.readFile(
      path.join(__dirname, "views", "addEvent.ejs"),
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
  } else if (req.method === "POST" && req.url === "/add-event") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      (async () => {
        const formData = querystring.parse(body);
        const { nama, alamat, waktuAcara, jamAcara, description } = formData;
        try {
          const sql =
            "INSERT INTO events (name, location, date, time, description) VALUES (?, ?, ?, ?, ?)";
          await db.execute(sql, [
            nama,
            alamat,
            waktuAcara,
            jamAcara,
            description,
          ]);
          res.writeHead(302, { Location: "/dashboard" });
          res.end();
        } catch (error) {
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end(
            `<h1>Database Error</h1><p>${error.message}</p><a href="/add_event">Back to form</a>`
          );
        }
      })();
    });
  } else if (req.method === "GET" && req.url.startsWith("/delete_event/")) {
    const eventId = req.url.split("/")[2];
    (async () => {
      try {
        await db.execute("DELETE FROM events WHERE id = ?", [eventId]);
        res.writeHead(302, { Location: "/dashboard" });
        res.end();
      } catch (error) {
        res.writeHead(500);
        res.end("Error deleting event: " + error.message);
      }
    })();
  } else if (req.method === "GET" && req.url.startsWith("/edit_event/")) {
    const eventId = req.url.split("/")[2];
    (async () => {
      try {
        const [rows] = await db.query("SELECT * FROM events WHERE id = ?", [
          eventId,
        ]);
        if (rows.length === 0) {
          res.writeHead(404);
          return res.end("Event not found");
        }
        const event = rows[0];
        fs.readFile(
          path.join(__dirname, "views", "editEvent.ejs"),
          "utf8",
          (err, data) => {
            if (err) {
              res.writeHead(500);
              return res.end("Error loading editEvent.ejs");
            }
            const rendered = ejs.render(data, { title: "Edit Event", event });
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(rendered);
          }
        );
      } catch (error) {
        res.writeHead(500);
        res.end("Error loading event: " + error.message);
      }
    })();
  } else if (req.method === "POST" && req.url.startsWith("/edit-event/")) {
    const eventId = req.url.split("/")[2];
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      (async () => {
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
      })();
    });
  } else if (req.method === "GET" && req.url.startsWith("/manage_event/")) {
    const eventId = req.url.split("/")[2];
    (async () => {
      try {
        const [eventRows] = await db.query(
          "SELECT * FROM events WHERE id = ?",
          [eventId]
        );
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
        fs.readFile(
          path.join(__dirname, "views", "manageEvent.ejs"),
          "utf8",
          (err, data) => {
            if (err) {
              res.writeHead(500);
              return res.end("Error loading manageEvent.ejs");
            }
            const rendered = ejs.render(data, {
              title: "Kelola Acara",
              event,
              guests: guestRows,
              documentation: docRows,
            });
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(rendered);
          }
        );
      } catch (error) {
        res.writeHead(500);
        res.end("Error loading manage event: " + error.message);
      }
    })();
  } else if (req.method === "GET" && req.url.startsWith("/event_list/")) {
    const eventId = req.url.split("/")[2];
    (async () => {
      try {
        const [rows] = await db.query("SELECT * FROM events WHERE id = ?", [
          eventId,
        ]);
        if (rows.length === 0) {
          res.writeHead(404);
          return res.end("Event not found");
        }
        const event = rows[0];
        fs.readFile(
          path.join(__dirname, "views", "eventList.ejs"),
          "utf8",
          (err, data) => {
            if (err) {
              res.writeHead(500);
              return res.end("Error loading eventList.ejs");
            }
            const rendered = ejs.render(data, { title: "Event List", event });
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(rendered);
          }
        );
      } catch (error) {
        res.writeHead(500);
        res.end("Error loading event list: " + error.message);
      }
    })();
  } else if (req.method === "GET" && req.url.startsWith("/rundown_list/")) {
    const eventId = req.url.split("/")[2];
    (async () => {
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
          path.join(__dirname, "views", "rundownList.ejs"),
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
    })();
  } else if (req.method === "POST" && req.url.startsWith("/add_rundown/")) {
    const eventId = req.url.split("/")[2];
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      (async () => {
        try {
          const formData = querystring.parse(body);
          const { kegiatan, tempat, jam, pembawa_acara } = formData;
          const sql =
            "INSERT INTO rundown (event_id, kegiatan, tempat, jam, pembawa_acara) VALUES (?, ?, ?, ?, ?)";
          await db.execute(sql, [
            eventId,
            kegiatan,
            tempat,
            jam,
            pembawa_acara,
          ]);
          // Reset and reschedule reminders after adding rundown
          clearScheduledJobs();
          await scheduleRundownReminders();
          res.writeHead(302, { Location: `/rundown_list/${eventId}` });
          res.end();
        } catch (error) {
          res.writeHead(500);
          res.end("Error adding rundown: " + error.message);
        }
      })();
    });
  } else if (req.method === "GET" && req.url.startsWith("/edit_rundown/")) {
    const rundownId = req.url.split("/")[2];
    (async () => {
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
          path.join(__dirname, "views", "editRundown.ejs"),
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
    })();
  } 
   else if (req.method === "POST" && req.url.startsWith("/edit_rundown/")) {
    (async () => {
    const rundownId = req.url.split("/")[2];
    let body = "";
    req.on("data", chunk => body += chunk.toString());
    req.on("end", async () => {
      try {
        const formData = querystring.parse(body);
        const { kegiatan, tempat, jam, pembawa_acara } = formData;
        await db.execute(
          "UPDATE rundown SET kegiatan=?, tempat=?, jam=?, pembawa_acara=? WHERE id=?",
          [kegiatan, tempat, jam, pembawa_acara, rundownId]
        );
        const [rows] = await db.query("SELECT event_id FROM rundown WHERE id=?", [rundownId]);
        const eventId = rows[0].event_id;
        res.writeHead(302, { Location: `/rundown_list/${eventId}` });
        res.end();
      } catch (error) {
        res.writeHead(500);
        res.end("Error editing rundown: " + error.message);
      }
    });
  })();
  } else if (req.method === "POST" && req.url.startsWith("/delete_rundown/")) {
    const rundownId = req.url.split("/")[2];
    (async () => {
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
    })();
  } else if (req.method === "POST" && req.url.startsWith("/delete_guest/")) {
    const guestId = req.url.split("/")[2];
    (async () => {
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
    })();
  } else if (req.method === "POST" && req.url.startsWith("/add_guest/")) {
    const eventId = req.url.split("/")[2];
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        const { name, email, phone, photoBase64 } = data;
        let photoUrl = null;
        if (photoBase64) {
          const matches = photoBase64.match(
            /^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/
          );
          if (matches) {
            const ext = matches[1];
            const buffer = Buffer.from(matches[2], "base64");
            const filename = `${Date.now()}-${Math.round(
              Math.random() * 1e9
            )}.${ext}`;
            const filepath = path.join(uploadDir, filename);
            fs.writeFileSync(filepath, buffer);
            photoUrl = `/uploads/${filename}`;
          }
        }
        const sql =
          "INSERT INTO guests (event_id, name, email, phone, photo_url) VALUES (?, ?, ?, ?, ?)";
        await db.execute(sql, [eventId, name, email, phone, photoUrl]);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(500);
        res.end("Error adding guest: " + error.message);
      }
    });
  } else if (req.method === "POST" && req.url.startsWith("/upload_documentation/")) {
    const eventId = req.url.split("/")[2];
    // Handle JSON upload from fetch with base64 file data
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        const { fileName, fileBase64, fileType } = data;
        if (!fileBase64 || !fileName) {
          res.writeHead(400);
          return res.end("No documentation file data provided");
        }
        // Decode base64 file
        const matches = fileBase64.match(
          /^data:([a-zA-Z0-9\/\-\+\.]+);base64,(.+)$/
        );
        if (!matches) {
          res.writeHead(400);
          return res.end("Invalid documentation file data");
        }
        const ext = path.extname(fileName) || "";
        const buffer = Buffer.from(matches[2], "base64");
        const filename = `${Date.now()}-${Math.round(
          Math.random() * 1e9
        )}${ext}`;
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, buffer);
        const file_url = `/uploads/${filename}`;
        const file_type = fileType || matches[1] || "application/octet-stream";
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
  } else if ( req.method === "POST" && req.url.startsWith("/api/send_rundown_reminders/") ) {
    const eventId = req.url.split("/")[2];
    (async () => {
      try {
        await clearScheduledJobs();
        await scheduleRundownReminders(eventId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, message: error.message }));
      }
    })();
  } else if (req.url.startsWith("/public")) {
    const filePath = path.join(__dirname, req.url);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("404 Not Found");
      }
      res.writeHead(200);
      res.end(data);
    });
  } else if (req.url.startsWith("/uploads")) {
    const filePath = path.join(__dirname, req.url);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("404 Not Found");
      }
      res.writeHead(200);
      res.end(data);
    });
  }
  // Fallback 404
  else {
    res.writeHead(404);
    res.end("404 Not Found");
  }
});

// Replace EJS placeholder
const renderEJS = (template, data) => {
  return template.replace(/<%= title %>/g, data.title);
};

(async () => {
  try {
    await scheduleRundownReminders();
    console.log("Scheduled rundown reminders on server start.");
  } catch (err) {
    console.error("Error scheduling rundown reminders on server start:", err);
  }

  server.listen(3000, () => {
    console.log("Server running at http://localhost:3000/");
  });
})();
