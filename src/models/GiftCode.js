const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

const GiftCode = sequelize.define('GiftCode', {
  id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  code:               { type: DataTypes.STRING, unique: true, allowNull: false },
  coinsValue:         { type: DataTypes.FLOAT, allowNull: false },
  maxUses:            { type: DataTypes.INTEGER, defaultValue: 1 },
  usedCount:          { type: DataTypes.INTEGER, defaultValue: 0 },
  usedBy:             { type: DataTypes.ARRAY(DataTypes.BIGINT), defaultValue: [] },
  minDepositRequired: { type: DataTypes.FLOAT, defaultValue: 0 },
  expiresAt:          { type: DataTypes.DATE, allowNull: true },
  isActive:           { type: DataTypes.BOOLEAN, defaultValue: true },
  createdBy:          { type: DataTypes.BIGINT, allowNull: true },
  description:        { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'gift_codes', timestamps: true });

GiftCode.prototype.canClaim = function(userId, userTotalDeposited) {
  if (!this.isActive) return { ok: false, msg: '❌ Gift code is no longer active.' };
  if (this.expiresAt && this.expiresAt < new Date()) return { ok: false, msg: '❌ Gift code has expired.' };
  if (this.usedCount >= this.maxUses) return { ok: false, msg: '❌ Gift code reached max uses.' };
  if (this.usedBy.includes(userId)) return { ok: false, msg: '❌ You already claimed this code.' };
  if (this.minDepositRequired > 0 && userTotalDeposited < this.minDepositRequired)
    return { ok: false, msg: `❌ Minimum ${this.minDepositRequired} coins deposit required.` };
  return { ok: true };
};

GiftCode.countDocuments = (where = {}) => GiftCode.count({ where });
GiftCode.findById = (id) => GiftCode.findOne({ where: { id } });

module.exports = GiftCode;
