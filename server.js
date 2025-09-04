const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 8000;
const publicDir = path.join(__dirname, 'public');

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=UTF-8';
    case '.js': return 'text/javascript; charset=UTF-8';
    case '.css': return 'text/css; charset=UTF-8';
    case '.json': return 'application/json; charset=UTF-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

const server = http.createServer((req, res) => {
  // Normalize and prevent path traversal
  const safePath = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^\/+/, '/');
  let filePath = path.join(publicDir, safePath);

  // If requesting a directory, serve index.html
  if (safePath.endsWith('/') || fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback to index.html
      const indexPath = path.join(publicDir, 'index.html');
      fs.readFile(indexPath, (indexErr, indexData) => {
        if (indexErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=UTF-8' });
          res.end('Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
          res.end(indexData);
        }
      });
    } else {
      res.writeHead(200, { 'Content-Type': getContentType(filePath) });
      res.end(data);
    }
  });
});

server.listen(port, () => {
  console.log(`PigeonToDoApp running at http://0.0.0.0:${port}`);
});

