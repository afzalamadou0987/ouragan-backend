const express = require('express');
const router = express.Router();
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyPromo
} = require('../controllers/cartController');
const { protect } = require('../middleware/auth');

// Toutes les routes du panier sont protégées
router.get('/', protect, getCart);
router.post('/add', protect, addToCart);
router.put('/item/:itemId', protect, updateCartItem);
router.delete('/item/:itemId', protect, removeFromCart);
router.delete('/clear', protect, clearCart);
router.post('/promo', protect, applyPromo);

module.exports = router;