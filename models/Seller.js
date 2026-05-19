const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Seller = sequelize.define('Seller', {
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
  shopName: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  shopDescription: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  logo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  banner: {
    type: DataTypes.STRING,
    allowNull: true
  },
  commissionRate: {
    type: DataTypes.FLOAT,
    defaultValue: 10.0
  },
  balance: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  totalSales: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0
  },
  totalReviews: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  documents: {
    type: DataTypes.JSON,
    allowNull: true
  },
  bankInfo: {
    type: DataTypes.JSON,
    allowNull: true
  }
});

module.exports = Seller;