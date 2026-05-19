const {
  Cart,
  CartItem,
  Product,
  ProductImage,
  ProductVariant
} = require('../models/index');

// ✅ OBTENIR MON PANIER
exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({
      where: { userId: req.user.id },
      include: [
        {
          model: CartItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              include: [{ model: ProductImage, as: 'images' }]
            },
            {
              model: ProductVariant,
              as: 'variant'
            }
          ]
        }
      ]
    });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Panier introuvable' });
    }

    res.status(200).json({ success: true, cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ AJOUTER UN PRODUIT AU PANIER
exports.addToCart = async (req, res) => {
  try {
    const { productId, variantId, quantity = 1 } = req.body;

    // Récupérer le panier
    let cart = await Cart.findOne({ where: { userId: req.user.id } });
    if (!cart) {
      cart = await Cart.create({ userId: req.user.id });
    }

    // Récupérer le produit
    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Produit introuvable' });
    }

    // Vérifier le stock
    if (product.stock < quantity) {
      return res.status(400).json({ success: false, message: 'Stock insuffisant' });
    }

    // Vérifier si le produit est déjà dans le panier
    let cartItem = await CartItem.findOne({
      where: { cartId: cart.id, productId, variantId: variantId || null }
    });

    const price = product.salePrice || product.price;

    if (cartItem) {
      // Mettre à jour la quantité
      cartItem.quantity += quantity;
      cartItem.totalPrice = cartItem.quantity * price;
      await cartItem.save();
    } else {
      // Créer un nouvel item
      cartItem = await CartItem.create({
        cartId: cart.id,
        productId,
        variantId: variantId || null,
        quantity,
        price,
        totalPrice: quantity * price
      });
    }

    // Mettre à jour le total du panier
    const allItems = await CartItem.findAll({ where: { cartId: cart.id } });
    const totalAmount = allItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalItems = allItems.reduce((sum, item) => sum + item.quantity, 0);

    await cart.update({ totalAmount, totalItems });

    res.status(200).json({
      success: true,
      message: 'Produit ajouté au panier !',
      cartItem
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ MODIFIER LA QUANTITE D'UN ITEM
exports.updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    const cart = await Cart.findOne({ where: { userId: req.user.id } });

    const cartItem = await CartItem.findOne({
      where: { id: itemId, cartId: cart.id }
    });

    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Article introuvable' });
    }

    if (quantity <= 0) {
      await cartItem.destroy();
    } else {
      cartItem.quantity = quantity;
      cartItem.totalPrice = quantity * cartItem.price;
      await cartItem.save();
    }

    // Mettre à jour le total du panier
    const allItems = await CartItem.findAll({ where: { cartId: cart.id } });
    const totalAmount = allItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalItems = allItems.reduce((sum, item) => sum + item.quantity, 0);

    await cart.update({ totalAmount, totalItems });

    res.status(200).json({
      success: true,
      message: 'Panier mis à jour !',
      cart
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ SUPPRIMER UN ITEM DU PANIER
exports.removeFromCart = async (req, res) => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ where: { userId: req.user.id } });

    const cartItem = await CartItem.findOne({
      where: { id: itemId, cartId: cart.id }
    });

    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Article introuvable' });
    }

    await cartItem.destroy();

    // Mettre à jour le total du panier
    const allItems = await CartItem.findAll({ where: { cartId: cart.id } });
    const totalAmount = allItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const totalItems = allItems.reduce((sum, item) => sum + item.quantity, 0);

    await cart.update({ totalAmount, totalItems });

    res.status(200).json({
      success: true,
      message: 'Article retiré du panier !'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ VIDER LE PANIER
exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ where: { userId: req.user.id } });

    await CartItem.destroy({ where: { cartId: cart.id } });
    await cart.update({ totalAmount: 0, totalItems: 0 });

    res.status(200).json({ success: true, message: 'Panier vidé !' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ APPLIQUER UN CODE PROMO
exports.applyPromo = async (req, res) => {
  try {
    const { code } = req.body;
    const { Promo } = require('../models/index');
    const { Op } = require('sequelize');

    const promo = await Promo.findOne({
      where: {
        code,
        isActive: true,
        startDate: { [Op.lte]: new Date() },
        endDate: { [Op.gte]: new Date() }
      }
    });

    if (!promo) {
      return res.status(404).json({ success: false, message: 'Code promo invalide ou expiré' });
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return res.status(400).json({ success: false, message: 'Ce code promo a atteint sa limite d\'utilisation' });
    }

    const cart = await Cart.findOne({ where: { userId: req.user.id } });

    if (cart.totalAmount < promo.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Montant minimum requis : ${promo.minOrderAmount}€`
      });
    }

    let discount = 0;
    if (promo.discountType === 'percentage') {
      discount = (cart.totalAmount * promo.discountValue) / 100;
    } else {
      discount = promo.discountValue;
    }

    res.status(200).json({
      success: true,
      message: 'Code promo appliqué !',
      promo: {
        code: promo.code,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        discount: discount.toFixed(2)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};