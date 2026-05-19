const {
  Seller,
  Product,
  ProductImage,
  ProductVariant,
  OrderItem,
  Order,
  User,
  Commission,
  Category
} = require('../models/index');
const { Op } = require('sequelize');

// ✅ DEVENIR VENDEUR
exports.becomeSeller = async (req, res) => {
  try {
    const { shopName, shopDescription, bankInfo } = req.body;

    // Vérifier si déjà vendeur
    const existingSeller = await Seller.findOne({
      where: { userId: req.user.id }
    });

    if (existingSeller) {
      return res.status(400).json({
        success: false,
        message: 'Vous êtes déjà vendeur'
      });
    }

    // Vérifier si le nom de boutique est déjà pris
    const existingShop = await Seller.findOne({ where: { shopName } });
    if (existingShop) {
      return res.status(400).json({
        success: false,
        message: 'Ce nom de boutique est déjà utilisé'
      });
    }

    const seller = await Seller.create({
      userId: req.user.id,
      shopName,
      shopDescription,
      bankInfo: bankInfo || null
    });

    // Mettre à jour le rôle de l'utilisateur
    await User.update(
      { role: 'seller' },
      { where: { id: req.user.id } }
    );

    res.status(201).json({
      success: true,
      message: 'Votre boutique a été créée ! En attente de vérification.',
      seller
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ MON PROFIL VENDEUR
exports.getSellerProfile = async (req, res) => {
  try {
    const seller = await Seller.findOne({
      where: { userId: req.user.id },
      include: [
        { model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] }
      ]
    });

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Profil vendeur introuvable' });
    }

    res.status(200).json({ success: true, seller });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ MODIFIER MON PROFIL VENDEUR
exports.updateSellerProfile = async (req, res) => {
  try {
    const { shopName, shopDescription, bankInfo } = req.body;

    const seller = await Seller.findOne({ where: { userId: req.user.id } });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Profil vendeur introuvable' });
    }

    await seller.update({ shopName, shopDescription, bankInfo });

    res.status(200).json({
      success: true,
      message: 'Profil mis à jour !',
      seller
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ AJOUTER UN PRODUIT
exports.addProduct = async (req, res) => {
  try {
    const {
      categoryId,
      name,
      description,
      price,
      salePrice,
      stock,
      sku,
      brand,
      weight,
      dimensions,
      tags,
      specifications
    } = req.body;

    const seller = await Seller.findOne({ where: { userId: req.user.id } });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Profil vendeur introuvable' });
    }

    if (!seller.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Votre boutique doit être vérifiée avant de vendre'
      });
    }

    // Générer le slug
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now();

    const product = await Product.create({
      sellerId: seller.id,
      categoryId,
      name,
      slug,
      description,
      price,
      salePrice: salePrice || null,
      stock,
      sku: sku || null,
      brand: brand || null,
      weight: weight || null,
      dimensions: dimensions || null,
      tags: tags || null,
      specifications: specifications || null
    });

    res.status(201).json({
      success: true,
      message: 'Produit ajouté !',
      product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ MES PRODUITS
exports.getMyProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const seller = await Seller.findOne({ where: { userId: req.user.id } });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Profil vendeur introuvable' });
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: { sellerId: seller.id },
      include: [
        { model: ProductImage, as: 'images' },
        { model: Category, as: 'category' }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      products
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ MODIFIER UN PRODUIT
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const seller = await Seller.findOne({ where: { userId: req.user.id } });
    const product = await Product.findOne({
      where: { id, sellerId: seller.id }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    await product.update(req.body);

    res.status(200).json({
      success: true,
      message: 'Produit mis à jour !',
      product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ SUPPRIMER UN PRODUIT
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const seller = await Seller.findOne({ where: { userId: req.user.id } });
    const product = await Product.findOne({
      where: { id, sellerId: seller.id }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    await product.update({ isActive: false });

    res.status(200).json({ success: true, message: 'Produit supprimé !' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ MES COMMANDES RECUES
exports.getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    const seller = await Seller.findOne({ where: { userId: req.user.id } });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Profil vendeur introuvable' });
    }

    const where = { sellerId: seller.id };
    if (status) where.status = status;

    const { count, rows: orders } = await OrderItem.findAndCountAll({
      where,
      include: [
        { model: Order, as: 'order', include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] }] },
        { model: Product, as: 'product' }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      orders
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ MES STATISTIQUES
exports.getMyStats = async (req, res) => {
  try {
    const seller = await Seller.findOne({ where: { userId: req.user.id } });
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Profil vendeur introuvable' });
    }

    const totalProducts = await Product.count({ where: { sellerId: seller.id } });
    const totalOrders = await OrderItem.count({ where: { sellerId: seller.id } });

    const commissions = await Commission.findAll({
      where: { sellerId: seller.id, status: 'paid' }
    });

    const totalEarnings = commissions.reduce((sum, c) => sum + c.sellerAmount, 0);
    const totalCommissions = commissions.reduce((sum, c) => sum + c.commissionAmount, 0);

    const recentOrders = await OrderItem.findAll({
      where: { sellerId: seller.id },
      include: [{ model: Order, as: 'order' }],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    res.status(200).json({
      success: true,
      stats: {
        totalProducts,
        totalOrders,
        totalEarnings,
        totalCommissions,
        balance: seller.balance,
        rating: seller.rating,
        recentOrders
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};