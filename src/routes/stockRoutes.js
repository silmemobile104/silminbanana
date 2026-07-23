const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const { authenticateToken, authorize } = require('../middleware/auth');

router.post('/receive', authenticateToken, stockController.receiveStock);
router.get('/receipts', authenticateToken, stockController.getGoodsReceipts);
router.put('/receipts/confirm-batch', authenticateToken, authorize('admin', 'hq_stock_staff', 'purchase_staff'), stockController.confirmBatchGoodsReceipts);
router.put('/receipts/:receiptId/confirm', authenticateToken, authorize('admin', 'hq_stock_staff', 'purchase_staff'), stockController.confirmGoodsReceipt);
router.put('/receipts/:receiptId', authenticateToken, stockController.updateGoodsReceipt);
router.delete('/receipts/:receiptId', authenticateToken, stockController.deleteGoodsReceipt);
router.get('/my-branch', authenticateToken, stockController.getMyBranchStock);
router.get('/branch/:branchId', authenticateToken, stockController.getBranchStock);
router.get('/all', authenticateToken, authorize('admin', 'hq_stock_staff', 'purchase_staff'), stockController.getAllBranchStock);

module.exports = router;
