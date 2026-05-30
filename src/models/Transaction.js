const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

const Transaction = sequelize.define('Transaction', {
  id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId:      { type: DataTypes.BIGINT, allowNull: false },
  type:        { type: DataTypes.ENUM('deposit','otp_purchase','referral_bonus','admin_credit','admin_debit','gift_code','new_user_bonus','refund'), allowNull: false },
  amount:      { type: DataTypes.FLOAT, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  status:      { type: DataTypes.ENUM('pending','completed','failed','cancelled'), defaultValue: 'completed' },
  metadata:    { type: DataTypes.JSONB, allowNull: true },
  balanceBefore: { type: DataTypes.FLOAT, allowNull: true },
  balanceAfter:  { type: DataTypes.FLOAT, allowNull: true },
}, { tableName: 'transactions', timestamps: true });

Transaction.countDocuments = (where = {}) => Transaction.count({ where });

module.exports = Transaction;
