import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5174;

// Dedicated Persistence File Path
const DATA_DIR = path.join(__dirname, 'data');
const LIVE_DATA_FILE = path.join(DATA_DIR, 'apartment_live.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

// If live data does not exist, initialize from src/data/apartment_seed.json
if (!fs.existsSync(LIVE_DATA_FILE)) {
  const seedPath = path.join(__dirname, 'src', 'data', 'apartment_seed.json');
  if (fs.existsSync(seedPath)) {
    fs.copyFileSync(seedPath, LIVE_DATA_FILE);
    console.log('[Server] Initialized live dataset from apartment_seed.json');
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.jsx': 'application/javascript; charset=UTF-8',
  '.ts': 'application/javascript; charset=UTF-8',
  '.tsx': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // =========================================================================
  // API ROUTE: GET /api/data -> Serve Authoritative Server Dataset
  // =========================================================================
  if (pathname === '/api/data' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (fs.existsSync(LIVE_DATA_FILE)) {
      fs.readFile(LIVE_DATA_FILE, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Failed to read live server data' }));
          return;
        }
        res.writeHead(200);
        res.end(data);
      });
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'No live data file found' }));
    }
    return;
  }

  // =========================================================================
  // API ROUTE: POST /api/data -> Atomically Persist Dataset
  // =========================================================================
  if (pathname === '/api/data' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (!parsed || !Array.isArray(parsed.maintenance_statements)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid apartment dataset structure' }));
          return;
        }

        // Atomic write via temp file
        const tempPath = `${LIVE_DATA_FILE}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(parsed, null, 2), 'utf8');
        fs.renameSync(tempPath, LIVE_DATA_FILE);

        // Keep rolling backup in background
        const dateStr = new Date().toISOString().slice(0, 10);
        const backupPath = path.join(BACKUPS_DIR, `apartment_live_${dateStr}.json`);
        fs.copyFile(LIVE_DATA_FILE, backupPath, () => {});

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, saved_at: new Date().toISOString() }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Server persistence failed' }));
      }
    });
    return;
  }

  // =========================================================================
  // STATIC ASSETS & SPA ROUTING
  // =========================================================================
  let reqPath = decodeURI(pathname);
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(__dirname, reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing
      const indexPath = path.join(__dirname, 'index.html');
      fs.readFile(indexPath, (err2, data) => {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        res.end(data);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Rockcliff 'B' Block Apartment App server running at http://127.0.0.1:${PORT}`);
});
