const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { sequelize } = require('./model');
const contractRoutes = require('./routes/contracts');
const jobsRoutes = require('./routes/jobs');
const adminRouter = require('./routes/admin');
const balanceRoutes = require('./routes/balances');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests, please try again later.'
});

const app = express();

app.use(cors()); 
app.use(helmet()); 
app.use(morgan('combined'));
app.use(limiter);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('sequelize', sequelize);
app.set('models', sequelize.models);

// Use routes
app.use('/contracts', contractRoutes);
app.use('/jobs', jobsRoutes);
app.use('/admin', adminRouter);
app.use('/balances', balanceRoutes);

module.exports = app;
