const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const productController = require('../controllers/productController');
const { authenticateToken, authorize } = require('../middleware/auth');

router.get('/', authenticateToken, productController.getAllProducts);
router.get('/:id', authenticateToken, productController.getProductById);
router.post(
  '/', 
  authenticateToken, 
  authorize('admin', 'hq_stock_staff', 'purchase_staff'), 
  upload.single('image'), 
  productController.createProduct
);

module.exports = router;
