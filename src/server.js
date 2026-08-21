require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');

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

// Connect to MongoDB & Auto-Seed Default Accounts if empty
connectDB().then(() => {
  autoSeedIfEmpty();
  seedDefaultRolesIfEmpty();
  repairData();
}).catch((err) => {
  console.error('🔴 เกิดข้อผิดพลาดขณะเริ่มเชื่อมต่อฐานข้อมูล:', err.message);
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files for frontend UI (no cache for development)
app.use(express.static(path.join(__dirname, '../public'), {
  etag: false,
  lastModified: false,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

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

// Fallback to index.html for SPA single-page routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Server] Silmin Banana POS & Audit System running on http://localhost:${PORT}`);
});

module.exports = app;
