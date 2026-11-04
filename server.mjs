import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 5174;

// Dedicated Persistence File Paths
const DATA_DIR = path.join(__dirname, 'data');
const LIVE_DATA_FILE = path.join(DATA_DIR, 'apartment_live.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'security_audit_log.json');

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

// Ensure security audit log exists
if (!fs.existsSync(AUDIT_LOG_FILE)) {
  fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify([]), 'utf8');
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

function getClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return cfIp.trim();
  const xForwarded = req.headers['x-forwarded-for'];
  if (xForwarded) return xForwarded.split(',')[0].trim();
  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) return xRealIp.trim();
  return (req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1').replace('::ffff:', '');
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
  // API ROUTE: POST /api/audit/login -> Track Login Attempt Telemetry
  // =========================================================================
  if (pathname === '/api/audit/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const clientData = JSON.parse(body || '{}');
        const ip = getClientIp(req);
        const userAgent = req.headers['user-agent'] || 'Unknown';

        const record = {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toISOString(),
          ip,
          userAgent,
          role: clientData.role || 'user',
          flatNumber: clientData.flatNumber || null,
          username: clientData.username || (clientData.role === 'admin' ? 'Administrator' : clientData.role === 'watchman' ? 'Watchman (Laxman)' : `Flat ${clientData.flatNumber}`),
          status: clientData.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
          reason: clientData.reason || null,
          device: clientData.device || 'Desktop',
          os: clientData.os || 'Unknown OS',
          browser: clientData.browser || 'Browser',
          screenResolution: clientData.screenResolution || 'Unknown',
          viewport: clientData.viewport || 'Unknown',
          timezone: clientData.timezone || 'Asia/Kolkata',
          isProxyOrCloudflare: Boolean(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'])
        };

        // Read and append to log file (keep up to 2000 entries)
        let logs = [];
        try {
          if (fs.existsSync(AUDIT_LOG_FILE)) {
            logs = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf8') || '[]');
          }
        } catch (e) { logs = []; }

        logs.unshift(record); // newest first
        if (logs.length > 2000) logs = logs.slice(0, 2000);

        fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(logs, null, 2), 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, recorded: record.id, ip }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to record login audit' }));
      }
    });
    return;
  }

  // =========================================================================
  // API ROUTE: GET /api/audit/logins -> Server-Side Paginated Audit Logs
  // =========================================================================
  if (pathname === '/api/audit/logins' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    try {
      let logs = [];
      if (fs.existsSync(AUDIT_LOG_FILE)) {
        logs = JSON.parse(fs.readFileSync(AUDIT_LOG_FILE, 'utf8') || '[]');
      }

      // Query parameters
      const page = Math.max(1, parseInt(parsedUrl.searchParams.get('page') || '1', 10));
      const limit = Math.max(1, Math.min(100, parseInt(parsedUrl.searchParams.get('limit') || '10', 10)));
      const search = (parsedUrl.searchParams.get('search') || '').trim().toLowerCase();
      const statusFilter = (parsedUrl.searchParams.get('status') || 'ALL').toUpperCase();
      const roleFilter = (parsedUrl.searchParams.get('role') || 'ALL').toLowerCase();

      // Compute Global Stats before filtering
      const totalCount = logs.length;
      const failedCount = logs.filter(l => l.status === 'FAILED').length;
      const uniqueIps = new Set(logs.map(l => l.ip)).size;
      const mobileCount = logs.filter(l => (l.device || '').toLowerCase().includes('mobile')).length;
      const mobilePercent = totalCount > 0 ? Math.round((mobileCount / totalCount) * 100) : 0;

      // Filter
      let filtered = logs;
      if (statusFilter !== 'ALL') {
        filtered = filtered.filter(l => l.status === statusFilter);
      }
      if (roleFilter !== 'all') {
        filtered = filtered.filter(l => (l.role || '').toLowerCase() === roleFilter);
      }
      if (search) {
        filtered = filtered.filter(l => {
          const flatStr = l.flatNumber ? String(l.flatNumber) : '';
          const ipStr = l.ip || '';
          const userStr = l.username || '';
          const devStr = `${l.device} ${l.os} ${l.browser}`;
          return flatStr.includes(search) ||
                 ipStr.toLowerCase().includes(search) ||
                 userStr.toLowerCase().includes(search) ||
                 devStr.toLowerCase().includes(search);
        });
      }

      // Server-Side Slicing
      const filteredTotal = filtered.length;
      const totalPages = Math.ceil(filteredTotal / limit) || 1;
      const startIndex = (page - 1) * limit;
      const items = filtered.slice(startIndex, startIndex + limit);

      res.writeHead(200);
      res.end(JSON.stringify({
        items,
        total: filteredTotal,
        page,
        limit,
        totalPages,
        stats: {
          totalLogins: totalCount,
          failedAttempts: failedCount,
          uniqueIps,
          mobilePercent
        }
      }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Failed to retrieve security audit logs' }));
    }
    return;
  }

  // =========================================================================
  // API ROUTE: DELETE /api/audit/logins -> Clear Audit Logs (Admin Action)
  // =========================================================================
  if (pathname === '/api/audit/logins' && req.method === 'DELETE') {
    try {
      fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify([]), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Security audit logs cleared' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to clear logs' }));
    }
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
