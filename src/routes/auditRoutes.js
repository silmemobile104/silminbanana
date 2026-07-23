const express = require('express');
const router = express.Router();
const multer = require('multer');
const auditController = require('../controllers/auditController');
const { authenticateToken, authorize } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.get('/expected', authenticateToken, auditController.getBranchExpectedStock);
router.post('/submit', authenticateToken, auditController.submitBranchAudit);
router.post('/upload-imei-image', authenticateToken, upload.single('image'), auditController.uploadImeiImage);
router.get('/drive-image/:fileId', auditController.proxyDriveImage);
router.get('/dashboard', authenticateToken, authorize('admin', 'hq_stock_staff'), auditController.getHqDashboard);
router.post('/verify/:id', authenticateToken, authorize('admin', 'hq_stock_staff'), auditController.verifyOrRejectAudit);

module.exports = router;
