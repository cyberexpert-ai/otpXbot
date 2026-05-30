const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

const OtpOrder = sequelize.define('OtpOrder', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId:       { type: DataTypes.BIGINT, allowNull: false },
  service:      { type: DataTypes.STRING, allowNull: false },
  serviceCode:  { type: DataTypes.STRING, allowNull: true },
  phoneNumber:  { type: DataTypes.STRING, allowNull: true },
  activationId: { type: DataTypes.STRING, allowNull: true },
  otp:          { type: DataTypes.STRING, allowNull: true },
  smsText:      { type: DataTypes.TEXT, allowNull: true },
  status:       { type: DataTypes.ENUM('pending','waiting','received','cancelled','refunded','expired'), defaultValue: 'pending' },
  coinsCharged: { type: DataTypes.FLOAT, defaultValue: 0 },
  refunded:     { type: DataTypes.BOOLEAN, defaultValue: false },
  expiresAt:    { type: DataTypes.DATE, allowNull: true },
  completedAt:  { type: DataTypes.DATE, allowNull: true },
  attempts:     { type: DataTypes.INTEGER, defaultValue: 0 },
  messageId:    { type: DataTypes.BIGINT, allowNull: true },
  startedAt:    { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, { tableName: 'otp_orders', timestamps: true });

OtpOrder.countDocuments = (where = {}) => OtpOrder.count({ where });
OtpOrder.findById = (id) => OtpOrder.findOne({ where: { id } });
OtpOrder.findByIdAndUpdate = async (id, updates) => {
  await OtpOrder.update(updates, { where: { id } });
  return OtpOrder.findOne({ where: { id } });
};

module.exports = OtpOrder;
