const { Op } = require('sequelize');
const {
  Product,
  ProductImage,
  ProductVariant,
  Category,
  Seller,
  Review,
  User,
  Wishlist,
  Order,
  OrderItem
} = require('../models/index');

// ✅ OBTENIR TOUS LES PRODUITS
exports.getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      minPrice,
      maxPrice,
      rating,
      brand,
      search,
      sort = 'createdAt',
      order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const where = { isActive: true };

    if (category) where.categoryId = category;
    if (brand) where.brand = { [Op.iLike]: `%${brand}%` };
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = minPrice;
      if (maxPrice) where.price[Op.lte] = maxPrice;
    }
    if (rating) where.rating = { [Op.gte]: rating };
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { brand: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where,
      include: [
        { model: ProductImage, as: 'images' },
        { model: Category, as: 'category' },
        { model: Seller, as: 'seller', attributes: ['id', 'shopName', 'rating'] }
      ],
      order: [[sort, order]],
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

// ✅ OBTENIR UN PRODUIT PAR SON SLUG
exports.getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({
      where: { slug, isActive: true },
      include: [
        { model: ProductImage, as: 'images' },
        { model: ProductVariant, as: 'variants' },
        { model: Category, as: 'category' },
        {
          model: Seller,
          as: 'seller',
          attributes: ['id', 'shopName', 'rating', 'totalReviews', 'isVerified']
        },
        {
          model: Review,
          as: 'reviews',
          include: [
            { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'avatar'] }
          ],
          limit: 10
        }
      ]
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    res.status(200).json({ success: true, product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ OBTENIR LES PRODUITS FEATURED
exports.getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { isFeatured: true, isActive: true },
      include: [
        { model: ProductImage, as: 'images' },
        { model: Category, as: 'category' }
      ],
      limit: 10
    });

    res.status(200).json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ OBTENIR LES PRODUITS OURAGAN
exports.getOuraganProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { isOuragan: true, isActive: true },
      include: [
        { model: ProductImage, as: 'images' },
        { model: Category, as: 'category' }
      ],
      limit: 20
    });

    res.status(200).json({ success: true, products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ OBTENIR LES PRODUITS PAR CATEGORIE
exports.getProductsByCategory = async (req, res) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const category = await Category.findOne({ where: { slug } });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Catégorie introuvable' });
    }

    const { count, rows: products } = await Product.findAndCountAll({
      where: { categoryId: category.id, isActive: true },
      include: [
        { model: ProductImage, as: 'images' },
        { model: Seller, as: 'seller', attributes: ['id', 'shopName'] }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.status(200).json({
      success: true,
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      category,
      products
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ AJOUTER UN AVIS (achat vérifié obligatoire)
exports.addReview = async (req, res) => {
  try {
    const { productId } = req.params;
    const { rating, title, comment } = req.body;

    // Vérifier que l'utilisateur a bien acheté et reçu ce produit
    const verifiedPurchase = await OrderItem.findOne({
      where: { productId },
      include: [
        {
          model: Order,
          as: 'order',
          where: {
            userId: req.user.id,
            status: 'delivered'
          }
        }
      ]
    });

    if (!verifiedPurchase) {
      return res.status(403).json({
        success: false,
        message: 'Vous devez avoir acheté et reçu ce produit pour laisser un avis'
      });
    }

    // Vérifier si l'utilisateur a déjà laissé un avis
    const existingReview = await Review.findOne({
      where: { userId: req.user.id, productId }
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Vous avez déjà laissé un avis pour ce produit'
      });
    }

    const review = await Review.create({
      userId: req.user.id,
      productId,
      orderId: verifiedPurchase.order.id,
      rating,
      title,
      comment,
      isVerified: true
    });

    // Mettre à jour la note moyenne
    const reviews = await Review.findAll({ where: { productId } });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await Product.update(
      { rating: avgRating.toFixed(1), totalReviews: reviews.length },
      { where: { id: productId } }
    );

    res.status(201).json({
      success: true,
      message: 'Avis ajouté ! ✅ Achat vérifié',
      review
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ WISHLIST - AJOUTER / RETIRER
exports.toggleWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const existing = await Wishlist.findOne({
      where: { userId: req.user.id, productId }
    });

    if (existing) {
      await existing.destroy();
      return res.status(200).json({
        success: true,
        message: 'Retiré de la wishlist',
        inWishlist: false
      });
    }

    await Wishlist.create({ userId: req.user.id, productId });
    res.status(201).json({
      success: true,
      message: 'Ajouté à la wishlist',
      inWishlist: true
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ OBTENIR MA WISHLIST
exports.getWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findAll({
      where: { userId: req.user.id },
      include: [
        {
          model: Product,
          as: 'product',
          include: [{ model: ProductImage, as: 'images' }]
        }
      ]
    });

    res.status(200).json({ success: true, wishlist });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ OBTENIR TOUTES LES CATEGORIES
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { isActive: true, parentId: null },
      include: [{ model: Category, as: 'subCategories' }],
      order: [['order', 'ASC']]
    });

    res.status(200).json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};