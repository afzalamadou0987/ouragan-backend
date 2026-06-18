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
const {
  createProduct,
  updateProduct,
  addProductImage,
  deleteProductImage,
  deleteProduct
} = require('../controllers/productManageController');
const { protect, restrictTo } = require('../middleware/auth');

// Routes de gestion (admin/vendeur) - placées AVANT les routes publiques génériques
router.post('/manage', protect, restrictTo('admin', 'seller'), createProduct);
router.put('/manage/:id', protect, restrictTo('admin', 'seller'), updateProduct);
router.post('/manage/:id/images', protect, restrictTo('admin', 'seller'), addProductImage);
router.delete('/manage/images/:imageId', protect, restrictTo('admin', 'seller'), deleteProductImage);
router.delete('/manage/:id', protect, restrictTo('admin', 'seller'), deleteProduct);

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