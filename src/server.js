require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const compression = require('compression');

const connectDB = require('./config/db');
const autoSeedIfEmpty = require('./scripts/autoSeed');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const masterRoutes = require('./routes/masterRoutes');
const productRoutes = require('./routes/productRoutes');
const stockRoutes = require('./routes/stockRoutes');
const transferRoutes = require('./routes/transferRoutes');
const auditRoutes = require('./routes/auditRoutes');
const branchRoutes = require('./routes/branchRoutes');
const userRoutes = require('./routes/userRoutes');
const posRoutes = require('./routes/posRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const expenseRoutes = require('./routes/expenseRoutes');

const roleRoutes = require('./routes/roleRoutes');
const { seedDefaultRolesIfEmpty } = require('./controllers/roleController');

const app = express();
const PORT = process.env.PORT || 3000;

const repairData = require('./scripts/repairData');

// Connect to MongoDB & Auto-Seed Default Accounts if empty.
// Each startup task is isolated: if the database is unreachable these reject,
// and an unhandled rejection would take the whole process down before it can
// serve anything — including the health check that would explain why.
const runStartupTask = (name, fn) =>
  Promise.resolve()
    .then(fn)
    .catch(err => console.error(`🔴 งานเริ่มระบบ "${name}" ไม่สำเร็จ:`, err.message));

connectDB().then(() => {
  runStartupTask('autoSeed', autoSeedIfEmpty);
  runStartupTask('seedDefaultRoles', seedDefaultRolesIfEmpty);
  runStartupTask('repairData', repairData);
}).catch((err) => {
  console.error('🔴 เกิดข้อผิดพลาดขณะเริ่มเชื่อมต่อฐานข้อมูล:', err.message);
});

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for frontend UI
// Development: no cache at all, so edits show up on refresh.
// Production: long-lived cache for versioned assets (app.js / styles.css are
// requested with a ?v= query string), but index.html is always revalidated so
// a new ?v= is picked up immediately.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// index:false — the app shell is composed below rather than served raw.
app.use(express.static(path.join(__dirname, '../public'), {
  index: false,
  etag: IS_PRODUCTION,
  lastModified: IS_PRODUCTION,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    const isHtml = filePath.endsWith('.html');

    if (!IS_PRODUCTION || isHtml) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return;
    }

    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

/* ---------------------------------------------------------------------------
   App shell
   Every stylesheet in index.html is a render-blocking round trip before the
   first paint. They are folded into the HTML here instead, so the browser can
   paint from the first response. The CSS files stay on disk as the source of
   truth — edit them normally; this only changes how they reach the browser.
   The composed HTML is cached in memory and rebuilt when any input file's
   mtime changes, so editing CSS still shows up on the next refresh.
--------------------------------------------------------------------------- */
const PUBLIC_DIR = path.join(__dirname, '../public');
const INDEX_FILE = path.join(PUBLIC_DIR, 'index.html');
let shellCache = null;

function buildAppShell() {
  const html = fs.readFileSync(INDEX_FILE, 'utf8');
  const stamps = [fs.statSync(INDEX_FILE).mtimeMs];

  const composed = html.replace(
    /[ \t]*<link rel="stylesheet" href="\/([^"?]+)(?:\?[^"]*)?">[ \t]*\r?\n?/g,
    (tag, relPath) => {
      const cssPath = path.join(PUBLIC_DIR, relPath);
      try {
        const css = fs.readFileSync(cssPath, 'utf8');
        stamps.push(fs.statSync(cssPath).mtimeMs);
        return `  <style>/* ${relPath} */\n${css}\n  </style>\n`;
      } catch (err) {
        // Missing or unreadable file: leave the original <link> untouched.
        console.warn(`[AppShell] อ่าน ${relPath} ไม่ได้ ใช้ <link> เดิมแทน:`, err.message);
        return tag;
      }
    }
  );

  return { html: composed, key: stamps.join(':') };
}

function currentStampKey() {
  const stamps = [fs.statSync(INDEX_FILE).mtimeMs];
  const raw = fs.readFileSync(INDEX_FILE, 'utf8');
  for (const m of raw.matchAll(/<link rel="stylesheet" href="\/([^"?]+)(?:\?[^"]*)?">/g)) {
    try { stamps.push(fs.statSync(path.join(PUBLIC_DIR, m[1])).mtimeMs); } catch (e) { /* ignore */ }
  }
  return stamps.join(':');
}

function sendAppShell(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const key = currentStampKey();
    if (!shellCache || shellCache.key !== key) shellCache = buildAppShell();
    res.type('html').send(shellCache.html);
  } catch (err) {
    // Never let shell composition take the app down — serve the file as-is.
    console.error('[AppShell] ประกอบหน้าไม่สำเร็จ ส่งไฟล์ต้นฉบับแทน:', err.message);
    res.sendFile(INDEX_FILE);
  }
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/master', masterRoutes);
app.use('/api/products', productRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/stock/transfers', transferRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/expenses', expenseRoutes);

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Silmin Banana Multi-Branch Stock & Audit Management System',
    timestamp: new Date().toISOString()
  });
});

// Fallback to the app shell for SPA single-page routing.
app.get('*', sendAppShell);

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Server] Silmin Banana POS & Audit System running on http://localhost:${PORT}`);
});

module.exports = app;
