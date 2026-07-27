const express = require('express');
const router = express.Router();
const { getRoles, createRole, updateRole, deleteRole } = require('../controllers/roleController');
const { authenticateToken, authorize } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', getRoles);
router.post('/', authorize('admin'), createRole);
router.put('/:id', authorize('admin'), updateRole);
router.delete('/:id', authorize('admin'), deleteRole);

module.exports = router;
