const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

const User = sequelize.define('User', {
  telegramId:   { type: DataTypes.BIGINT, primaryKey: true },
  username:     { type: DataTypes.STRING, allowNull: true },
  firstName:    { type: DataTypes.STRING, allowNull: true },
  lastName:     { type: DataTypes.STRING, allowNull: true },
  balance:      { type: DataTypes.FLOAT, defaultValue: 0 },
  totalDeposited:  { type: DataTypes.FLOAT, defaultValue: 0 },
  totalOrders:  { type: DataTypes.INTEGER, defaultValue: 0 },
  totalSpent:   { type: DataTypes.FLOAT, defaultValue: 0 },
  referredBy:   { type: DataTypes.BIGINT, allowNull: true },
  referralCode: { type: DataTypes.STRING, unique: true },
  referralCount:{ type: DataTypes.INTEGER, defaultValue: 0 },
  referralEarned:{ type: DataTypes.FLOAT, defaultValue: 0 },
  isVip:        { type: DataTypes.BOOLEAN, defaultValue: false },
  isBanned:     { type: DataTypes.BOOLEAN, defaultValue: false },
  banReason:    { type: DataTypes.TEXT, allowNull: true },
  isVerified:   { type: DataTypes.BOOLEAN, defaultValue: false },
  bonusReceived:{ type: DataTypes.BOOLEAN, defaultValue: false },
  customOtpCost:{ type: DataTypes.FLOAT, allowNull: true },
  claimedGiftCodes: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  deviceFingerprints: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  ipAddresses:  { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  notificationsEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastActive:   { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  joinedAt:     { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'users', timestamps: true });

User.prototype.canAfford = function(cost) { return this.balance >= cost; };
User.prototype.deductBalance = async function(amount) {
  this.balance -= amount; this.totalSpent += amount; await this.save();
};
User.prototype.addBalance = async function(amount) {
  this.balance += amount; await this.save();
};

// Static helpers to mimic Mongoose API
User.findOne = User.findOne.bind(User);
User.countDocuments = (where = {}) => User.count({ where });

module.exports = User;
