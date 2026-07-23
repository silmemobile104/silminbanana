const express = require('express');
const router = express.Router();

const posController = require('../controllers/posController');
const { authenticateToken, authorize } = require('../middleware/auth');

router.post('/checkout', authenticateToken, posController.createSale);
router.get('/receipt/:id', authenticateToken, posController.getSaleReceipt);
router.get('/history', authenticateToken, posController.getSalesHistory);
router.get('/finance-report', authenticateToken, posController.getFinanceProfitReport);
router.put('/finance-payout/:id', authenticateToken, posController.updateFinancePayoutStatus);

module.exports = router;
