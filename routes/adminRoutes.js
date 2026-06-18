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
const { Product, ProductImage } = require('../models/index');

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
router.put('/products/:id', protect, restrictTo('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    const { images, ...productData } = req.body;
    await product.update(productData);

    if (images && images.length > 0) {
      const existingCount = await ProductImage.count({ where: { productId: id } });
      for (let i = 0; i < images.length; i++) {
        await ProductImage.create({
          productId: id,
          url: images[i].url,
          publicId: images[i].publicId || null,
          isMain: existingCount === 0 && i === 0,
          order: existingCount + i
        });
      }
    }

    const fullProduct = await Product.findByPk(id, {
      include: [{ model: ProductImage, as: 'images' }]
    });

    res.status(200).json({ success: true, message: 'Produit mis à jour !', product: fullProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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