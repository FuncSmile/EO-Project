const http = require("http");
const path = require("path");
const fs = require("fs");
const {
  client,
  scheduleRundownReminders,
  clearScheduledJobs,
} = require("./whatsappReminder");
const { renderEJS } = require("./utils/renderEJS");

const authController = require("./controllers/authController");
const eventController = require("./controllers/eventController");
const rundownController = require("./controllers/rundownController");
const guestController = require("./controllers/guestController");
const documentationController = require("./controllers/documentationController");
const whatsappController = require("./controllers/whatsappController");
const staticController = require("./controllers/staticController");

// Setup upload directory
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Listen to QR event and generate base64 image
// client.on("qr", (qr) => {
//   console.log("QR RECEIVED", qr);
//   whatsappController.setLatestQRImage(qr);
// });

const server = http.createServer((req, res) => {
  const { method, url } = req;

  if (method === "GET" && url === "/") {
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
  } else if (method === "GET" && url === "/whatsapp_qr") {
    whatsappController.getWhatsappQR(req, res);
  } else if (method === "GET" && url === "/whatsapp_qr_page") {
    whatsappController.getWhatsappQRPage(req, res);
  } else if (method === "POST" && url === "/login") {
    authController.loginFallback(req, res);
  } else if (method === "POST" && url === "/api/login") {
    authController.apiLogin(req, res);
  } else if (method === "GET" && url === "/login") {
    authController.loginPage(req, res);
  } else if (method === "GET" && url.startsWith("/dashboard")) {
    eventController.dashboard(req, res);
  } else if (method === "GET" && url === "/members") {
    eventController.membersPage(req, res);
  } else if (method === "GET" && url.startsWith("/see_event/")) {
    eventController.seeEvent(req, res);
  } else if (method === "GET" && url === "/add_event") {
    eventController.addEventPage(req, res);
  } else if (method === "POST" && url === "/add-event") {
    eventController.addEvent(req, res);
  } else if (method === "GET" && url.startsWith("/delete_event/")) {
    eventController.deleteEvent(req, res);
  } else if (method === "GET" && url.startsWith("/edit_event/")) {
    eventController.editEventPage(req, res);
  } else if (method === "POST" && url.startsWith("/edit-event/")) {
    eventController.editEvent(req, res);
  } else if (method === "GET" && url.startsWith("/manage_event/")) {
    eventController.manageEvent(req, res);
  } else if (method === "GET" && url.startsWith("/event_list/")) {
    eventController.eventList(req, res);
  } else if (method === "GET" && url.startsWith("/rundown_list/")) {
    rundownController.rundownList(req, res);
  } else if (method === "POST" && url.startsWith("/add_rundown/")) {
    rundownController.addRundown(req, res);
  } else if (method === "GET" && url.startsWith("/edit_rundown/")) {
    rundownController.editRundownPage(req, res);
  } else if (method === "POST" && url.startsWith("/edit_rundown/")) {
    rundownController.editRundown(req, res);
  } else if (method === "POST" && url.startsWith("/delete_rundown/")) {
    rundownController.deleteRundown(req, res);
  } else if (method === "POST" && url.startsWith("/delete_guest/")) {
    guestController.deleteGuest(req, res);
  } else if (method === "POST" && url.startsWith("/add_guest/")) {
    guestController.addGuest(req, res);
  } else if (method === "POST" && url.startsWith("/upload_documentation/")) {
    documentationController.uploadDocumentation(req, res);
  } else if (
    method === "POST" &&
    url.startsWith("/api/send_rundown_reminders/")
  ) {
    rundownController.sendRundownReminders(req, res);
  } else if (url.startsWith("/public")) {
    staticController.servePublic(req, res);
  } else if (url.startsWith("/uploads")) {
    // Serve static files from uploads directory
    const filePath = path.join(__dirname, "uploads", url.replace("/uploads/", ""));
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("File not found");
      } else {
        // Set content type based on file extension
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
          ".pdf": "application/pdf",
          ".mp4": "video/mp4",
          ".mov": "video/quicktime",
          ".avi": "video/x-msvideo",
        };
        const contentType = mimeTypes[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
      }
    });
  } else if (method === "GET" && url.startsWith("/thankyou/")) {
    const thankyouController = require("./controllers/thankyouController");
    thankyouController.thankyouPage(req, res);
  } else {
    res.writeHead(404);
    res.end("404 Not Found");
  }
});

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
