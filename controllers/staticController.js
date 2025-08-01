const fs = require("fs");
const path = require("path");

function servePublic(req, res) {
  const filePath = path.join(__dirname, "..", req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("404 Not Found");
    }
    res.writeHead(200);
    res.end(data);
  });
}

function serveUploads(req, res) {
  const filePath = path.join(__dirname, "..", req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end("404 Not Found");
    }
    res.writeHead(200);
    res.end(data);
  });
}

module.exports = {
  servePublic,
  serveUploads,
};
