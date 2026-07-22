const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const { authenticateToken, authorize } = require('../middleware/auth');

router.post('/', authenticateToken, transferController.createTransfer);
router.get('/', authenticateToken, transferController.getTransfers);
router.put('/:id/status', authenticateToken, transferController.updateTransferStatus);
router.get('/:id/document', authenticateToken, transferController.getTransferDocument);

module.exports = router;
