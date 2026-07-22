const express = require('express');
const router = express.Router();

const posController = require('../controllers/posController');
const { authenticateToken, authorize } = require('../middleware/auth');

router.post('/checkout', authenticateToken, posController.createSale);
router.get('/receipt/:id', authenticateToken, posController.getSaleReceipt);
router.get('/history', authenticateToken, posController.getSalesHistory);

module.exports = router;
