const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.jsx': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function sendFile(res, filePath, statusCode = 200) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=UTF-8' });
      res.end('Internal Server Error');
      return;
    }
    res.writeHead(statusCode, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // Normalize and prevent directory traversal
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let requestedPath = path.normalize(urlPath).replace(/^\/+/, '');
  if (requestedPath === '') requestedPath = 'index.html';

  const filePath = path.join(PUBLIC_DIR, requestedPath);

  // If path is a directory, serve index.html within it
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      fs.access(indexPath, fs.constants.F_OK, (idxErr) => {
        if (idxErr) {
          // SPA fallback to root index.html
          return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
        }
        return sendFile(res, indexPath);
      });
      return;
    }

    fs.access(filePath, fs.constants.F_OK, (accErr) => {
      if (accErr) {
        // SPA fallback to root index.html
        return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
      }
      return sendFile(res, filePath);
    });
  });
});

server.listen(PORT, () => {
  console.log(`PigeonToDoApp server running on http://0.0.0.0:${PORT}`);
});

