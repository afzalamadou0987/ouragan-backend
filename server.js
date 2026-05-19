const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const { connectDB, sequelize } = require('./config/database');

require('./models/index');

// Import routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const sellerRoutes = require('./routes/sellerRoutes');

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/seller', sellerRoutes);

// Route de test
app.get('/', (req, res) => {
  res.json({ message: '🌀 Bienvenue sur OURAGAN API !' });
});

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  await sequelize.sync({ alter: true });
  console.log('✅ Base de données synchronisée !');
  app.listen(PORT, () => {
    console.log(`✅ Serveur OURAGAN lancé sur le port ${PORT}`);
  });
};

start();