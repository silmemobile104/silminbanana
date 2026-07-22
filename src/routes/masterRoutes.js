const express = require('express');
const router = express.Router();
const masterController = require('../controllers/masterController');
const { authenticateToken, authorize } = require('../middleware/auth');

router.get('/options', authenticateToken, masterController.getMasterOptions);
router.post('/options', authenticateToken, authorize('admin', 'hq_stock_staff', 'purchase_staff'), masterController.createMasterOption);
router.put('/options/:id', authenticateToken, authorize('admin', 'hq_stock_staff', 'purchase_staff'), masterController.updateMasterOption);
router.delete('/options/:id', authenticateToken, authorize('admin', 'hq_stock_staff', 'purchase_staff'), masterController.deleteMasterOption);

module.exports = router;
