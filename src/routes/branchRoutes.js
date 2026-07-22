const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { authenticateToken, authorize } = require('../middleware/auth');

router.get('/', authenticateToken, branchController.getAllBranches);
router.post('/', authenticateToken, authorize('admin'), branchController.createBranch);
router.put('/:id', authenticateToken, authorize('admin'), branchController.updateBranch);

module.exports = router;
