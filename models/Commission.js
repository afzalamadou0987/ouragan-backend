const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Commission = sequelize.define('Commission', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  sellerId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  orderItemId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  saleAmount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  commissionRate: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  commissionAmount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  sellerAmount: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'cancelled'),
    defaultValue: 'pending'
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
});

module.exports = Commission;