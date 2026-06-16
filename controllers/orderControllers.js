const {
  Order,
  OrderItem,
  Cart,
  CartItem,
  Product,
  ProductImage,
  Address,
  Payment,
  Commission,
  Seller,
  User,
  Promo
} = require('../models/index');
const { Delivery } = require('../models/Delivery');
const { Op } = require('sequelize');

// ✅ Générer un numéro de commande unique
const generateOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `OUR-${year}${month}${day}-${random}`;
};

// ✅ CRÉER UNE COMMANDE
exports.createOrder = async (req, res) => {
  try {
    const { addressId, promoCode, notes, shippingCost = 0, paymentMethod = 'cash' } = req.body;

    // Récupérer le panier avec tous les articles
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
            }
          ]
        }
      ]
    });

    // Vérifier que le panier n'est pas vide
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Votre panier est vide'
      });
    }

    // Vérifier que l'adresse existe et appartient à l'utilisateur
    const address = await Address.findOne({
      where: { id: addressId, userId: req.user.id }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Adresse introuvable'
      });
    }

    // Calculer la remise promo si applicable
    let discount = 0;
    let promo = null;
    if (promoCode) {
      promo = await Promo.findOne({
        where: {
          code: promoCode,
          isActive: true,
          startDate: { [Op.lte]: new Date() },
          endDate: { [Op.gte]: new Date() }
        }
      });

      if (promo) {
        if (promo.discountType === 'percentage') {
          discount = (cart.totalAmount * promo.discountValue) / 100;
        } else {
          discount = promo.discountValue;
        }
        // Incrémenter le compteur d'utilisation du promo
        await promo.update({ usedCount: promo.usedCount + 1 });
      }
    }

    // Calculer le montant total
    const totalAmount = cart.totalAmount + shippingCost - discount;

    // Créer la commande
    const order = await Order.create({
      userId: req.user.id,
      addressId,
      orderNumber: generateOrderNumber(),
      subTotal: cart.totalAmount,
      shippingCost,
      discount,
      totalAmount,
      promoCode: promoCode || null,
      notes: notes || null,
      paymentMethod: paymentMethod || 'cash',
      estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    });

    // Créer les articles de commande
    for (const item of cart.items) {
      const product = item.product;

      await OrderItem.create({
        orderId: order.id,
        productId: item.productId,
        sellerId: product.sellerId || null,
        variantId: item.variantId || null,
        productName: product.name,
        productImage: product.images[0]?.url || null,
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice,
        commission: product.sellerId ? (item.totalPrice * 10) / 100 : 0
      });

      // Déduire le stock du produit
      await Product.update(
        { stock: product.stock - item.quantity },
        { where: { id: product.id } }
      );

      // Créer la commission si c'est un produit marketplace
      if (product.sellerId) {
        const seller = await Seller.findByPk(product.sellerId);
        const commissionAmount = (item.totalPrice * seller.commissionRate) / 100;
        const sellerAmount = item.totalPrice - commissionAmount;

        await Commission.create({
          sellerId: product.sellerId,
          orderId: order.id,
          orderItemId: order.id,
          saleAmount: item.totalPrice,
          commissionRate: seller.commissionRate,
          commissionAmount,
          sellerAmount
        });
      }
    }

    // Créer automatiquement une livraison en attente
    await Delivery.create({
      orderId: order.id,
      status: 'pending'
    });

    // Vider le panier après la commande
    await CartItem.destroy({ where: { cartId: cart.id } });
    await cart.update({ totalAmount: 0, totalItems: 0 });

    // Récupérer la commande complète avec tous les détails
    const fullOrder = await Order.findByPk(order.id, {
      include: [
        { model: OrderItem, as: 'items' },
        { model: Address, as: 'address' }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Commande créée avec succès !',
      order: fullOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ MES COMMANDES
exports.getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;
    const where = { userId: req.user.id };

    if (status) where.status = status;

    const { count, rows: orders } = await Order.findAndCountAll({
      where,
      include: [
        { model: OrderItem, as: 'items' },
        { model: Address, as: 'address' }
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

// ✅ DETAIL D'UNE COMMANDE
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      where: { id, userId: req.user.id },
      include: [
        {
          model: OrderItem,
          as: 'items',
          include: [
            {
              model: Product,
              as: 'product',
              include: [{ model: ProductImage, as: 'images' }]
            }
          ]
        },
        { model: Address, as: 'address' },
        { model: Payment, as: 'payment' }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande introuvable'
      });
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ ANNULER UNE COMMANDE
exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      where: { id, userId: req.user.id }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande introuvable'
      });
    }

    // Vérifier que la commande peut encore être annulée
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cette commande ne peut plus être annulée'
      });
    }

    await order.update({ status: 'cancelled' });

    // Remettre le stock des produits
    const items = await OrderItem.findAll({ where: { orderId: order.id } });
    for (const item of items) {
      await Product.increment('stock', {
        by: item.quantity,
        where: { id: item.productId }
      });
      await item.update({ status: 'cancelled' });
    }

    res.status(200).json({
      success: true,
      message: 'Commande annulée !'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ SUIVRE UNE COMMANDE
exports.trackOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const order = await Order.findOne({
      where: { orderNumber, userId: req.user.id },
      include: [
        { model: OrderItem, as: 'items' },
        { model: Address, as: 'address' }
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande introuvable'
      });
    }

    // Construire le suivi étape par étape
    const tracking = {
      orderNumber: order.orderNumber,
      status: order.status,
      estimatedDelivery: order.estimatedDelivery,
      trackingNumber: order.trackingNumber,
      steps: [
        {
          label: 'Commande passée',
          done: true,
          date: order.createdAt
        },
        {
          label: 'Confirmée',
          done: ['confirmed', 'preparing', 'shipped', 'delivered'].includes(order.status)
        },
        {
          label: 'En préparation',
          done: ['preparing', 'shipped', 'delivered'].includes(order.status)
        },
        {
          label: 'Expédiée',
          done: ['shipped', 'delivered'].includes(order.status)
        },
        {
          label: 'Livrée',
          done: order.status === 'delivered',
          date: order.deliveredAt
        }
      ]
    };

    res.status(200).json({ success: true, tracking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};