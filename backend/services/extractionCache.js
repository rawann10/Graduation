// Singleton cache — Node modules are cached, so both routes share this object.
// analyze.js writes lastExtraction; debug.js reads it.
module.exports = { lastExtraction: null };
