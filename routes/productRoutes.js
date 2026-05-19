const express = require('express');
const router = express.Router();
const {
  getAllProducts,
  getProductBySlug,
  getFeaturedProducts,
  getOuraganProducts,
  getProductsByCategory,
  addReview,
  toggleWishlist,
  getWishlist,
  getAllCategories
} = require('../controllers/productController');
const { protect } = require('../middleware/auth');

// Routes publiques
router.get('/', getAllProducts);
router.get('/featured', getFeaturedProducts);
router.get('/ouragan', getOuraganProducts);
router.get('/categories', getAllCategories);
router.get('/category/:slug', getProductsByCategory);
router.get('/:slug', getProductBySlug);

// Routes protégées
router.post('/:productId/review', protect, addReview);
router.post('/:productId/wishlist', protect, toggleWishlist);
router.get('/wishlist/me', protect, getWishlist);

module.exports = router;