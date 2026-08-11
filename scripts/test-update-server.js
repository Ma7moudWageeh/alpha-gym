const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const RELEASES_DIR = path.join(__dirname, '../test-releases');

const server = http.createServer((req, res) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  
  // Basic security to prevent directory traversal
  const safeSuffix = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(RELEASES_DIR, safeSuffix);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      console.log(`[404 NOT FOUND] ${filePath}`);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    console.log(`[200 OK] Serving ${filePath}`);
    
    // Set basic headers for Electron-updater
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.exe': 'application/x-msdownload',
      '.yml': 'text/yaml',
      '.yaml': 'text/yaml',
      '.json': 'application/json',
      '.zip': 'application/zip',
      '.blockmap': 'application/octet-stream'
    };
    
    res.writeHead(200, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Content-Length': stats.size,
      'Access-Control-Allow-Origin': '*'
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('====================================================');
  console.log('  Alpha Gym - Local Update Test Server');
  console.log('====================================================');
  console.log(`  Server is running on: http://localhost:${PORT}/`);
  console.log(`  Serving files from:   ${RELEASES_DIR}`);
  console.log('');
  console.log('  INSTRUCTIONS TO TEST AUTO-UPDATER:');
  console.log('  1. Bump version in package.json (e.g. 1.0.1).');
  console.log('  2. Run: npm run build');
  console.log('  3. Copy all files from dist/installers into test-releases/');
  console.log('  4. Revert package.json to original version (e.g. 1.0.0).');
  console.log('  5. Start Alpha Gym (npm run dev or built app).');
  console.log('  6. Check the Notification Bell for the update alert!');
  console.log('====================================================\n');
});
