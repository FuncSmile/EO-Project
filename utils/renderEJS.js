const ejs = require('ejs');

function renderEJS(template, data) {
  return ejs.render(template, data);
}

module.exports = { renderEJS };
