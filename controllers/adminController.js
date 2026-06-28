const {
  User, Seller, Product, ProductImage, Order, OrderItem,
  Payment, Commission, Category, Promo, Review
} = require('../models/index');
const { Op, QueryTypes } = require('sequelize');

// ✅ DASHBOARD STATS
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers    = await User.count({ where: { role: 'client' } });
    const totalSellers  = await Seller.count();
    const totalProducts = await Product.count({ where: { isActive: true } });
    const totalOrders   = await Order.count();
    const totalRevenue  = await Order.sum('totalAmount', { where: { paymentStatus: 'paid' } });
    const pendingOrders   = await Order.count({ where: { status: 'pending' } });
    const pendingSellers  = await Seller.count({ where: { isVerified: false } });

    const recentOrders = await Order.findAll({
      include: [
        { model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] },
        { model: OrderItem, as: 'items' }
      ],
      order: [['createdAt', 'DESC']], limit: 10
    });

    const recentUsers = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']], limit: 5
    });

    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyOrders  = await Order.count({ where: { createdAt: { [Op.gte]: last7Days } } });
    const weeklyRevenue = await Order.sum('totalAmount', {
      where: { paymentStatus: 'paid', createdAt: { [Op.gte]: last7Days } }
    });

    // Compte les livreurs sans dépendre de l'enum
    const totalLivreurs = await User.count({
      where: { role: { [Op.in]: ['livreur', 'delivery', 'driver'] } }
    });

    res.status(200).json({
      success: true,
      stats: {
        totalUsers, totalSellers, totalProducts, totalOrders,
        totalRevenue: totalRevenue || 0,
        pendingOrders, pendingSellers,
        weeklyOrders, weeklyRevenue: weeklyRevenue || 0,
        totalLivreurs, recentOrders, recentUsers
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ ANALYTICS
exports.getAnalytics = async (req, res) => {
  try {
    const sequelize = Order.sequelize;
    const period = req.query.period || '30d';
    const daysMap = { '7d': 7, '30d': 30, '90d': 90, all: null };
    const days = period in daysMap ? daysMap[period] : 30;
    const since    = days ? new Date(Date.now() - days * 86400000) : new Date('2000-01-01');
    const prevSince = days ? new Date(Date.now() - 2 * days * 86400000) : new Date('2000-01-01');
    const WHERE = `o.status <> 'cancelled' AND o."createdAt" >= :since`;

    const [overview] = await sequelize.query(
      `SELECT COALESCE(SUM(o."totalAmount"),0) AS revenue, COUNT(*) AS orders, COUNT(DISTINCT o."userId") AS customers FROM "Orders" o WHERE ${WHERE}`,
      { type: QueryTypes.SELECT, replacements: { since } }
    );
    const [prev] = await sequelize.query(
      `SELECT COALESCE(SUM(o."totalAmount"),0) AS revenue FROM "Orders" o WHERE o.status <> 'cancelled' AND o."createdAt" >= :prevSince AND o."createdAt" < :since`,
      { type: QueryTypes.SELECT, replacements: { since, prevSince } }
    );
    const byCategory = await sequelize.query(
      `SELECT c.name AS category, COALESCE(SUM(oi.price * oi.quantity),0) AS revenue, COUNT(DISTINCT o.id) AS orders FROM "OrderItems" oi JOIN "Orders" o ON o.id = oi."orderId" JOIN "Products" p ON p.id = oi."productId" JOIN "Categories" c ON c.id = p."categoryId" WHERE ${WHERE} GROUP BY c.name ORDER BY revenue DESC`,
      { type: QueryTypes.SELECT, replacements: { since } }
    );
    const split = await sequelize.query(
      `SELECT p."isOuragan" AS is_ouragan, COALESCE(SUM(oi.price * oi.quantity),0) AS revenue, COALESCE(SUM(oi.quantity),0) AS items, COUNT(DISTINCT o.id) AS orders FROM "OrderItems" oi JOIN "Orders" o ON o.id = oi."orderId" JOIN "Products" p ON p.id = oi."productId" WHERE ${WHERE} GROUP BY p."isOuragan"`,
      { type: QueryTypes.SELECT, replacements: { since } }
    );
    const overTime = await sequelize.query(
      `SELECT TO_CHAR(o."createdAt", 'YYYY-MM-DD') AS date, COALESCE(SUM(o."totalAmount"),0) AS revenue FROM "Orders" o WHERE ${WHERE} GROUP BY date ORDER BY date`,
      { type: QueryTypes.SELECT, replacements: { since } }
    );
    const topProducts = await sequelize.query(
      `SELECT p.name, p."isOuragan" AS is_ouragan, COALESCE(SUM(oi.price * oi.quantity),0) AS revenue, COALESCE(SUM(oi.quantity),0) AS quantity FROM "OrderItems" oi JOIN "Orders" o ON o.id = oi."orderId" JOIN "Products" p ON p.id = oi."productId" WHERE ${WHERE} GROUP BY p.id, p.name, p."isOuragan" ORDER BY revenue DESC LIMIT 8`,
      { type: QueryTypes.SELECT, replacements: { since } }
    );
    const byStatus = await sequelize.query(
      `SELECT o.status, COUNT(*) AS count FROM "Orders" o WHERE o."createdAt" >= :since GROUP BY o.status`,
      { type: QueryTypes.SELECT, replacements: { since } }
    );

    const revenue     = Number(overview.revenue);
    const orders      = Number(overview.orders);
    const prevRevenue = Number(prev.revenue);
    const growth = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10 : null;
    const ouragan    = split.find((s) => s.is_ouragan === true)  || { revenue: 0, items: 0, orders: 0 };
    const marketplace = split.find((s) => s.is_ouragan === false) || { revenue: 0, items: 0, orders: 0 };

    res.json({
      success: true, period,
      overview: {
        totalRevenue: revenue, totalOrders: orders,
        avgOrderValue: orders ? Math.round(revenue / orders) : 0,
        totalCustomers: Number(overview.customers), revenueGrowth: growth,
      },
      revenueByCategory: byCategory.map((r) => ({ category: r.category, revenue: Number(r.revenue), orders: Number(r.orders) })),
      ouraganVsMarketplace: {
        ouragan:     { revenue: Number(ouragan.revenue),     items: Number(ouragan.items),     orders: Number(ouragan.orders) },
        marketplace: { revenue: Number(marketplace.revenue), items: Number(marketplace.items), orders: Number(marketplace.orders) },
      },
      revenueOverTime: overTime.map((r) => ({ date: r.date, revenue: Number(r.revenue) })),
      topProducts:     topProducts.map((r) => ({ name: r.name, isOuragan: r.is_ouragan, revenue: Number(r.revenue), quantity: Number(r.quantity) })),
      ordersByStatus:  byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
    });
  } catch (err) {
    console.error('getAnalytics error:', err);
    res.status(500).json({ success: false, message: err.message });
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
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName:  { [Op.iLike]: `%${search}%` } },
        { email:     { [Op.iLike]: `%${search}%` } }
      ];
    }
    const { count, rows: users } = await User.findAndCountAll({
      where, attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit), offset: parseInt(offset)
    });
    res.status(200).json({ success: true, count, totalPages: Math.ceil(count / limit), currentPage: parseInt(page), users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ TOGGLE USER
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    await user.update({ isActive: !user.isActive });
    res.status(200).json({ success: true, message: user.isActive ? 'Compte activé !' : 'Compte désactivé !', user });
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
      include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit), offset: parseInt(offset)
    });
    res.status(200).json({ success: true, count, totalPages: Math.ceil(count / limit), currentPage: parseInt(page), sellers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ VERIFIER VENDEUR
exports.verifySeller = async (req, res) => {
  try {
    const seller = await Seller.findByPk(req.params.id);
    if (!seller) return res.status(404).json({ success: false, message: 'Vendeur introuvable' });
    await seller.update({ isVerified: true, isActive: true });
    res.status(200).json({ success: true, message: 'Vendeur vérifié !', seller });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GESTION PRODUITS
exports.getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;
    const offset = (page - 1) * limit;
    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where[Op.or] = [
        { name:  { [Op.iLike]: `%${search}%` } },
        { brand: { [Op.iLike]: `%${search}%` } }
      ];
    }
    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [
        { model: ProductImage, as: 'images' },
        { model: Seller,   as: 'seller',   attributes: ['shopName'] },
        { model: Category, as: 'category' }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit), offset: parseInt(offset)
    });
    res.status(200).json({ success: true, count, totalPages: Math.ceil(count / limit), currentPage: parseInt(page), products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ AJOUTER PRODUIT OURAGAN
exports.addOuraganProduct = async (req, res) => {
  try {
    const { categoryId, name, description, price, salePrice, stock, sku, brand, weight, dimensions, tags, specifications, isFeatured, isOuragan, images } = req.body;
    if (!categoryId || !name || !description || !price) {
      return res.status(400).json({ success: false, message: 'Catégorie, nom, description et prix sont obligatoires' });
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
    const product = await Product.create({
      sellerId: null, categoryId, name, slug, description, price,
      salePrice: salePrice || null, stock: stock || 0, sku: sku || null,
      brand: brand || null, weight: weight || null, dimensions: dimensions || null,
      tags: tags || null, specifications: specifications || null,
      isOuragan: isOuragan !== undefined ? isOuragan : true,
      isFeatured: isFeatured || false
    });
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        await ProductImage.create({
          productId: product.id, url: images[i].url,
          publicId: images[i].publicId || null, isMain: i === 0, order: i
        });
      }
    }
    const fullProduct = await Product.findByPk(product.id, { include: [{ model: ProductImage, as: 'images' }] });
    res.status(201).json({ success: true, message: 'Produit OURAGAN ajouté !', product: fullProduct });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ GESTION COMMANDES
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
      limit: parseInt(limit), offset: parseInt(offset)
    });
    res.status(200).json({ success: true, count, totalPages: Math.ceil(count / limit), currentPage: parseInt(page), orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ MODIFIER STATUT COMMANDE
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status, trackingNumber } = req.body;
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Commande introuvable' });
    const updateData = { status };
    if (trackingNumber) updateData.trackingNumber = trackingNumber;
    if (status === 'delivered') updateData.deliveredAt = new Date();
    await order.update(updateData);
    await OrderItem.update({ status }, { where: { orderId: req.params.id } });
    res.status(200).json({ success: true, message: 'Statut mis à jour !', order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ CATEGORIES
exports.createCategory = async (req, res) => {
  try {
    const { name, description, parentId, image, order } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const category = await Category.create({ name, slug, description, parentId: parentId || null, image: image || null, order: order || 0 });
    res.status(201).json({ success: true, message: 'Catégorie créée !', category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Catégorie introuvable' });
    await category.update(req.body);
    res.status(200).json({ success: true, message: 'Catégorie mise à jour !', category });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Catégorie introuvable' });
    await category.update({ isActive: false });
    res.status(200).json({ success: true, message: 'Catégorie supprimée !' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ PROMOS
exports.createPromo = async (req, res) => {
  try {
    const { code, description, discountType, discountValue, minOrderAmount, maxUses, startDate, endDate } = req.body;
    const promo = await Promo.create({
      code: code.toUpperCase(), description, discountType, discountValue,
      minOrderAmount: minOrderAmount || 0, maxUses: maxUses || null, startDate, endDate
    });
    res.status(201).json({ success: true, message: 'Code promo créé !', promo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllPromos = async (req, res) => {
  try {
    const promos = await Promo.findAll({ order: [['createdAt', 'DESC']] });
    res.status(200).json({ success: true, promos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePromo = async (req, res) => {
  try {
    const promo = await Promo.findByPk(req.params.id);
    if (!promo) return res.status(404).json({ success: false, message: 'Promo introuvable' });
    await promo.update({ isActive: false });
    res.status(200).json({ success: true, message: 'Promo désactivée !' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};