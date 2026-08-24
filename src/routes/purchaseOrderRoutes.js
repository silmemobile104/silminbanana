const express = require('express');
const router = express.Router();
const { getPurchaseOrders, getPurchaseOrderById, createPurchaseOrder, receivePurchaseOrder, updatePurchaseOrder, cancelPurchaseOrder, markAsReceived } = require('../controllers/purchaseOrderController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', getPurchaseOrders);
router.get('/:id', getPurchaseOrderById);
router.post('/', createPurchaseOrder);
router.put('/:id', updatePurchaseOrder);
router.post('/:id/cancel', cancelPurchaseOrder);
router.post('/:id/receive', receivePurchaseOrder);
router.post('/:id/mark-received', markAsReceived);

module.exports = router;
