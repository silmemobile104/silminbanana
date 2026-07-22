const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticateToken, authorize } = require('../middleware/auth');

router.get('/expected', authenticateToken, auditController.getBranchExpectedStock);
router.post('/submit', authenticateToken, auditController.submitBranchAudit);
router.get('/dashboard', authenticateToken, authorize('admin', 'hq_stock_staff'), auditController.getHqDashboard);
router.post('/verify/:id', authenticateToken, authorize('admin', 'hq_stock_staff'), auditController.verifyOrRejectAudit);

module.exports = router;
