const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const SERVE_DIR = path.join(__dirname, '../dist');

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Prevent directory traversal
  const safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(SERVE_DIR, safePath === '/' ? 'latest.yml' : safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const extname = path.extname(filePath);
    let contentType = 'application/octet-stream';
    if (extname === '.yml' || extname === '.yaml') contentType = 'text/yaml';
    else if (extname === '.exe') contentType = 'application/x-msdownload';
    else if (extname === '.zip') contentType = 'application/zip';
    else if (extname === '.json') contentType = 'application/json';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Local Update Server running at http://localhost:${PORT}/`);
  console.log(`Serving files from: ${SERVE_DIR}`);
});
