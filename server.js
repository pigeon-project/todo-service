// Minimal static file server for SPA on port 8000
const http = require('http');
const path = require('path');
const fs = require('fs');

const dist = path.join(__dirname, 'dist');
const port = process.env.PORT ? Number(process.env.PORT) : 8000;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8'
};

function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  let filePath = path.join(dist, url);
  if (url === '/' || !path.extname(url)) {
    filePath = path.join(dist, 'index.html');
  }
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback
      serveFile(path.join(dist, 'index.html'), res);
      return;
    }
    serveFile(filePath, res);
  });
});

server.listen(port, () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});

