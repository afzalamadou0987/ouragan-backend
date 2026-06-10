const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Delivery = sequelize.define('Delivery', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  livreurId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM(
      'pending',
      'assigned',
      'picked_up',
      'in_transit',
      'delivered',
      'failed'
    ),
    defaultValue: 'pending'
  },
  assignedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  pickedUpAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  deliveredAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  livreurNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  estimatedTime: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
});

module.exports = Delivery;