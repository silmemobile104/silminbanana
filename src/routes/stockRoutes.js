const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const { authenticateToken, authorize } = require('../middleware/auth');

router.post('/receive', authenticateToken, stockController.receiveStock);
router.get('/my-branch', authenticateToken, stockController.getMyBranchStock);
router.get('/branch/:branchId', authenticateToken, stockController.getBranchStock);
router.get('/all', authenticateToken, authorize('admin', 'hq_stock_staff', 'purchase_staff'), stockController.getAllBranchStock);

module.exports = router;
