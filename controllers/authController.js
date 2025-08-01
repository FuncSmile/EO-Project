const querystring = require("querystring");

const dummyData = {
  username: "ADMIN",
  password: "ADMIN123",
};

function loginPage(req, res) {
  const fs = require("fs");
  const path = require("path");
  const { renderEJS } = require("../utils/renderEJS");

  fs.readFile(path.join(__dirname, "..", "views", "login.ejs"), "utf8", (err, data) => {
    if (err) {
      res.writeHead(500);
      return res.end("Error loading login.ejs");
    }
    const rendered = renderEJS(data, { title: "Login" });
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(rendered);
  });
}

function loginFallback(req, res) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", () => {
    const formData = querystring.parse(body);

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
}

function apiLogin(req, res) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });
  req.on("end", () => {
    const formData = querystring.parse(body);

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
}

module.exports = {
  loginPage,
  loginFallback,
  apiLogin,
};
