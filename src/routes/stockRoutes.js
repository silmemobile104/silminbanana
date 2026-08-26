const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const { authenticateToken, authorize } = require('../middleware/auth');

router.post('/receive', authenticateToken, stockController.receiveStock);
router.get('/receipts', authenticateToken, stockController.getGoodsReceipts);
router.put('/receipts/confirm-batch', authenticateToken, stockController.confirmBatchGoodsReceipts);
router.put('/receipts/:receiptId/confirm', authenticateToken, stockController.confirmGoodsReceipt);
router.put('/receipts/:receiptId', authenticateToken, stockController.updateGoodsReceipt);
router.delete('/receipts/:receiptId', authenticateToken, stockController.deleteGoodsReceipt);
router.get('/my-branch', authenticateToken, stockController.getMyBranchStock);
router.get('/branch/:branchId', authenticateToken, stockController.getBranchStock);
router.get('/all', authenticateToken, authorize('admin', 'hq_stock_staff', 'purchase_staff'), stockController.getAllBranchStock);
router.post('/release', authenticateToken, authorize('admin', 'hq_stock_staff'), stockController.releaseStockItems);
router.post('/query-imeis', authenticateToken, authorize('admin', 'hq_stock_staff'), stockController.queryImeiDetails);
router.get('/release/history', authenticateToken, authorize('admin', 'hq_stock_staff'), stockController.getReleasedStockHistory);
router.post('/release/:id/cancel', authenticateToken, authorize('admin', 'hq_stock_staff'), stockController.cancelReleaseStockItem);
router.put('/:id', authenticateToken, stockController.updateStock);

module.exports = router;
