const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

let latestQRImage = null;

function setLatestQRImage(qr) {
  QRCode.toDataURL(qr)
    .then((dataUrl) => {
      latestQRImage = dataUrl;
      console.log("QR code base64 image updated");
    })
    .catch((err) => {
      console.error("Error generating QR code image:", err);
    });
}

function getWhatsappQR(req, res) {
  const maxRetries = 10;
  const retryIntervalMs = 500;
  let attempts = 0;

  const sendQR = () => {
    if (latestQRImage) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ qrImage: latestQRImage }));
    } else {
      attempts++;
      if (attempts > maxRetries) {
        console.warn("QR code requested but not available after retries");
        res.writeHead(504);
        res.end(JSON.stringify({ error: "QR code not available" }));
      } else {
        setTimeout(sendQR, retryIntervalMs);
      }
    }
  };

  sendQR();
}

function getWhatsappQRPage(req, res) {
  fs.readFile(
    path.join(__dirname, "..", "views", "whatsappQR.ejs"),
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
}

module.exports = {
  setLatestQRImage,
  getWhatsappQR,
  getWhatsappQRPage,
  latestQRImage,
};
