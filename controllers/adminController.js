const {
  User,
  Seller,
  Product,
  ProductImage,
  Order,
  OrderItem,
  Payment,
  Commission,
  Category,
  Promo,
  Review
} = require('../models/index');
const { Op } = require('sequelize');

// ✅ DASHBOARD STATS
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.count({ where: { role: 'client' } });
    const totalSellers = await Seller.count();
    const totalProducts = await Product.count({ where: { isActive: true } });
    const totalOrders = await Order.count();

    const totalRevenue = await Order.sum('totalAmount', {
      where: { paymentStatus: 'paid' }
    });

    const pendingOrders = await Order.count({ where: { status: 'pending' } });
    const pendingSellers = await Seller.count({ where: { isVerified: false } });

    const recentOrders = await Order.findAll({
      include: [
        { model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] },
        { model: OrderItem, as: 'items' }
      ],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const recentUsers = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    // Stats des 7 derniers jours
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyOrders = await Order.count({
      where: { createdAt: { [Op.gte]: last7Days } }
    });
    const weeklyRevenue = await Order.sum('totalAmount', {
      where: {
        paymentStatus: 'paid',
        createdAt: { [Op.gte]: last7Days }
      }
    });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalSellers,
        totalProducts,
        totalOrders,
        totalRevenue: totalRevenue || 0,
        pendingOrders,
        pendingSellers,
        weeklyOrders,
        weeklyRevenue: weeklyRevenue || 0,
        recentOrders,
        recentUsers
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GESTION UTILISATEURS
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (role) where.role = role;
    if (search) {
      where[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      users
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ ACTIVER / DÉSACTIVER UN UTILISATEUR
exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    await user.update({ isActive: !user.isActive });

    res.status(200).json({
      success: true,
      message: user.isActive ? 'Compte activé !' : 'Compte désactivé !',
      user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GESTION VENDEURS
exports.getAllSellers = async (req, res) => {
  try {
    const { page = 1, limit = 20, isVerified } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (isVerified !== undefined) where.isVerified = isVerified === 'true';

    const { count, rows: sellers } = await Seller.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] }
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
      sellers
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ VERIFIER UN VENDEUR
exports.verifySeller = async (req, res) => {
  try {
    const { id } = req.params;

    const seller = await Seller.findByPk(id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Vendeur introuvable' });
    }

    await seller.update({ isVerified: true, isActive: true });

    res.status(200).json({
      success: true,
      message: 'Vendeur vérifié !',
      seller
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GESTION PRODUITS ADMIN
exports.getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { brand: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [
        { model: ProductImage, as: 'images' },
        { model: Seller, as: 'seller', attributes: ['shopName'] },
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

// ✅ AJOUTER UN PRODUIT OURAGAN
exports.addOuraganProduct = async (req, res) => {
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
      specifications,
      isFeatured
    } = req.body;

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now();

    const product = await Product.create({
      sellerId: null,
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
      specifications: specifications || null,
      isOuragan: true,
      isFeatured: isFeatured || false
    });

    res.status(201).json({
      success: true,
      message: 'Produit OURAGAN ajouté !',
      product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GESTION COMMANDES ADMIN
exports.getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;
    const where = {};

    if (status) where.status = status;

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] },
        { model: OrderItem, as: 'items' }
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

// ✅ MODIFIER STATUT COMMANDE
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber } = req.body;

    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande introuvable' });
    }

    const updateData = { status };
    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (status === 'delivered') updateData.deliveredAt = new Date();

    await order.update(updateData);

    // Mettre à jour le statut des items
    await OrderItem.update({ status }, { where: { orderId: id } });

    res.status(200).json({
      success: true,
      message: 'Statut mis à jour !',
      order
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GESTION CATEGORIES
exports.createCategory = async (req, res) => {
  try {
    const { name, description, parentId, image, order } = req.body;

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const category = await Category.create({
      name,
      slug,
      description,
      parentId: parentId || null,
      image: image || null,
      order: order || 0
    });

    res.status(201).json({
      success: true,
      message: 'Catégorie créée !',
      category
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ MODIFIER UNE CATEGORIE
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Catégorie introuvable' });
    }

    await category.update(req.body);

    res.status(200).json({
      success: true,
      message: 'Catégorie mise à jour !',
      category
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ SUPPRIMER UNE CATEGORIE
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByPk(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Catégorie introuvable' });
    }

    await category.update({ isActive: false });

    res.status(200).json({ success: true, message: 'Catégorie supprimée !' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GESTION PROMOS
exports.createPromo = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderAmount,
      maxUses,
      startDate,
      endDate
    } = req.body;

    const promo = await Promo.create({
      code: code.toUpperCase(),
      description,
      discountType,
      discountValue,
      minOrderAmount: minOrderAmount || 0,
      maxUses: maxUses || null,
      startDate,
      endDate
    });

    res.status(201).json({
      success: true,
      message: 'Code promo créé !',
      promo
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ TOUTES LES PROMOS
exports.getAllPromos = async (req, res) => {
  try {
    const promos = await Promo.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({ success: true, promos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ SUPPRIMER UNE PROMO
exports.deletePromo = async (req, res) => {
  try {
    const { id } = req.params;

    const promo = await Promo.findByPk(id);
    if (!promo) {
      return res.status(404).json({ success: false, message: 'Promo introuvable' });
    }

    await promo.update({ isActive: false });

    res.status(200).json({ success: true, message: 'Promo désactivée !' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};