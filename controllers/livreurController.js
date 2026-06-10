const { Delivery, Order, OrderItem, User, Address, Message } = require('../models/index');
const { Op } = require('sequelize');

// ✅ MES LIVRAISONS
exports.getMyDeliveries = async (req, res) => {
  try {
    const { status } = req.query;
    const where = { livreurId: req.user.id };
    if (status) where.status = status;

    const deliveries = await Delivery.findAll({
      where,
      include: [
        {
          model: Order,
          as: 'order',
          include: [
            { model: OrderItem, as: 'items' },
            { model: Address, as: 'address' },
            { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'phone'] }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({ success: true, deliveries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ LIVRAISONS DISPONIBLES
exports.getAvailableDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.findAll({
      where: { status: 'pending', livreurId: null },
      include: [
        {
          model: Order,
          as: 'order',
          include: [
            { model: Address, as: 'address' },
            { model: User, as: 'user', attributes: ['id', 'firstName', 'lastName'] }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({ success: true, deliveries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ ACCEPTER UNE LIVRAISON
exports.acceptDelivery = async (req, res) => {
  try {
    const { id } = req.params;

    const delivery = await Delivery.findByPk(id);
    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Livraison introuvable' });
    }

    if (delivery.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Cette livraison n\'est plus disponible' });
    }

    await delivery.update({
      livreurId: req.user.id,
      status: 'assigned',
      assignedAt: new Date()
    });

    res.status(200).json({ success: true, message: 'Livraison acceptée !', delivery });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ METTRE À JOUR LE STATUT
exports.updateDeliveryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const delivery = await Delivery.findOne({
      where: { id, livreurId: req.user.id }
    });

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Livraison introuvable' });
    }

    const updateData = { status, livreurNotes: notes };

    if (status === 'picked_up') updateData.pickedUpAt = new Date();
    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
      await Order.update(
        { status: 'delivered', deliveredAt: new Date() },
        { where: { id: delivery.orderId } }
      );
    }

    await delivery.update(updateData);

    res.status(200).json({ success: true, message: 'Statut mis à jour !', delivery });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ ENVOYER UN MESSAGE
exports.sendMessage = async (req, res) => {
  try {
    const { deliveryId, content, receiverId } = req.body;

    const message = await Message.create({
      deliveryId,
      senderId: req.user.id,
      receiverId,
      content,
      type: 'text'
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ OBTENIR LES MESSAGES
exports.getMessages = async (req, res) => {
  try {
    const { deliveryId } = req.params;

    const messages = await Message.findAll({
      where: { deliveryId },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'firstName', 'lastName', 'avatar'] }
      ],
      order: [['createdAt', 'ASC']]
    });

    await Message.update(
      { isRead: true },
      { where: { deliveryId, receiverId: req.user.id } }
    );

    res.status(200).json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ STATS LIVREUR
exports.getLivreurStats = async (req, res) => {
  try {
    const totalDeliveries = await Delivery.count({
      where: { livreurId: req.user.id }
    });

    const completedDeliveries = await Delivery.count({
      where: { livreurId: req.user.id, status: 'delivered' }
    });

    const pendingDeliveries = await Delivery.count({
      where: { livreurId: req.user.id, status: 'assigned' }
    });

    const recentDeliveries = await Delivery.findAll({
      where: { livreurId: req.user.id },
      include: [
        {
          model: Order,
          as: 'order',
          include: [{ model: Address, as: 'address' }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    res.status(200).json({
      success: true,
      stats: {
        totalDeliveries,
        completedDeliveries,
        pendingDeliveries,
        recentDeliveries
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};