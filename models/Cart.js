const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Cart = sequelize.define('Cart', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  totalAmount: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  totalItems: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});

module.exports = Cart;