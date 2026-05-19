const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  toggleUserStatus,
  getAllSellers,
  verifySeller,
  getAllProducts,
  addOuraganProduct,
  getAllOrders,
  updateOrderStatus,
  createCategory,
  updateCategory,
  deleteCategory,
  createPromo,
  getAllPromos,
  deletePromo
} = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/auth');

// Dashboard
router.get('/stats', protect, restrictTo('admin'), getDashboardStats);

// Utilisateurs
router.get('/users', protect, restrictTo('admin'), getAllUsers);
router.put('/users/:id/toggle', protect, restrictTo('admin'), toggleUserStatus);

// Vendeurs
router.get('/sellers', protect, restrictTo('admin'), getAllSellers);
router.put('/sellers/:id/verify', protect, restrictTo('admin'), verifySeller);

// Produits
router.get('/products', protect, restrictTo('admin'), getAllProducts);
router.post('/products', protect, restrictTo('admin'), addOuraganProduct);

// Commandes
router.get('/orders', protect, restrictTo('admin'), getAllOrders);
router.put('/orders/:id/status', protect, restrictTo('admin'), updateOrderStatus);

// Categories
router.post('/categories', protect, restrictTo('admin'), createCategory);
router.put('/categories/:id', protect, restrictTo('admin'), updateCategory);
router.delete('/categories/:id', protect, restrictTo('admin'), deleteCategory);

// Promos
router.post('/promos', protect, restrictTo('admin'), createPromo);
router.get('/promos', protect, restrictTo('admin'), getAllPromos);
router.delete('/promos/:id', protect, restrictTo('admin'), deletePromo);

module.exports = router;