const express = require('express');
const router = express.Router();
const {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  trackOrder
} = require('../controllers/orderControllers');
const { protect } = require('../middleware/auth');

// Toutes les routes commandes sont protégées
router.post('/', protect, createOrder);
router.get('/', protect, getMyOrders);
router.get('/:id', protect, getOrderById);
router.put('/:id/cancel', protect, cancelOrder);
router.get('/track/:orderNumber', protect, trackOrder);

module.exports = router;