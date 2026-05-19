const express = require('express');
const router = express.Router();
const {
  becomeSeller,
  getSellerProfile,
  updateSellerProfile,
  addProduct,
  getMyProducts,
  updateProduct,
  deleteProduct,
  getMyOrders,
  getMyStats
} = require('../controllers/sellerController');
const { protect, restrictTo } = require('../middleware/auth');

// Toutes les routes vendeur sont protégées
router.post('/become', protect, becomeSeller);
router.get('/profile', protect, restrictTo('seller', 'admin'), getSellerProfile);
router.put('/profile', protect, restrictTo('seller', 'admin'), updateSellerProfile);
router.post('/products', protect, restrictTo('seller', 'admin'), addProduct);
router.get('/products', protect, restrictTo('seller', 'admin'), getMyProducts);
router.put('/products/:id', protect, restrictTo('seller', 'admin'), updateProduct);
router.delete('/products/:id', protect, restrictTo('seller', 'admin'), deleteProduct);
router.get('/orders', protect, restrictTo('seller', 'admin'), getMyOrders);
router.get('/stats', protect, restrictTo('seller', 'admin'), getMyStats);

module.exports = router;