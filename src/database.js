const { Sequelize } = require('sequelize');

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  console.error('❌ DATABASE_URL not set!');
  process.exit(1);
}

const sequelize = new Sequelize(DB_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
  logging: false,
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
});

async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('✅ PostgreSQL connected');
    // Sync all models (create tables if not exist)
    await sequelize.sync({ alter: false });
    console.log('✅ Tables synced');
  } catch (err) {
    console.error('❌ DB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = { sequelize, connectDB };
