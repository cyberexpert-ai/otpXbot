const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');

const DepositRequest = sequelize.define('DepositRequest', {
  id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  userId:          { type: DataTypes.BIGINT, allowNull: false },
  coins:           { type: DataTypes.FLOAT, allowNull: false },
  amountInr:       { type: DataTypes.FLOAT, allowNull: false },
  utr:             { type: DataTypes.STRING, allowNull: true },
  screenshotFileId:{ type: DataTypes.STRING, allowNull: true },
  status:          { type: DataTypes.ENUM('pending','approved','rejected'), defaultValue: 'pending' },
  adminId:         { type: DataTypes.BIGINT, allowNull: true },
  adminNote:       { type: DataTypes.TEXT, allowNull: true },
  processedAt:     { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'deposit_requests', timestamps: true });

DepositRequest.countDocuments = (where = {}) => DepositRequest.count({ where });
DepositRequest.findById = (id) => DepositRequest.findOne({ where: { id } });

module.exports = DepositRequest;
