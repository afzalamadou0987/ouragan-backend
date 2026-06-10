const express = require('express');
const router = express.Router();
const {
  getMyDeliveries,
  getAvailableDeliveries,
  acceptDelivery,
  updateDeliveryStatus,
  sendMessage,
  getMessages,
  getLivreurStats
} = require('../controllers/livreurController');
const { protect, restrictTo } = require('../middleware/auth');

// Toutes les routes livreur sont protégées
router.get('/deliveries', protect, restrictTo('livreur', 'admin'), getMyDeliveries);
router.get('/deliveries/available', protect, restrictTo('livreur', 'admin'), getAvailableDeliveries);
router.put('/deliveries/:id/accept', protect, restrictTo('livreur', 'admin'), acceptDelivery);
router.put('/deliveries/:id/status', protect, restrictTo('livreur', 'admin'), updateDeliveryStatus);
router.post('/messages', protect, sendMessage);
router.get('/messages/:deliveryId', protect, getMessages);
router.get('/stats', protect, restrictTo('livreur', 'admin'), getLivreurStats);

module.exports = router;