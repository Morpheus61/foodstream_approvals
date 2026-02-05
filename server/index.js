require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const session = require('express-session');
const morgan = require('morgan');
const path = require('path');

const logger = require('./utils/logger');
const { checkHealth } = require('./config/database');
const { apiLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const licenseRoutes = require('./routes/licenses');
const onboardingRoutes = require('./routes/onboarding');
const adminRoutes = require('./routes/admin');
const companyRoutes = require('./routes/companies');
const userRoutes = require('./routes/users');
const payeeRoutes = require('./routes/payees');
const voucherRoutes = require('./routes/vouchers');
const reportRoutes = require('./routes/reports');
const notificationRoutes = require('./routes/notifications');
const brandingRoutes = require('./routes/branding');
const pricingRoutes = require('./routes/pricing');
const signatureRoutes = require('./routes/signatures');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// =====================================================
// SECURITY & MIDDLEWARE
// =====================================================

// Helmet for security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", process.env.SUPABASE_URL]
        }
    }
}));

// CORS configuration
const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Compression
app.use(compression());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: parseInt(process.env.SESSION_MAX_AGE) || 86400000 // 24 hours
    }
}));

// Request logging
app.use(morgan('combined', {
    stream: {
        write: (message) => logger.info(message.trim())
    }
}));

// Trust proxy (for rate limiting with correct IP)
app.set('trust proxy', 1);

// =====================================================
// HEALTH CHECK ENDPOINTS
// =====================================================

app.get('/health', async (req, res) => {
    const dbHealthy = await checkHealth();
    
    res.status(dbHealthy ? 200 : 503).json({
        status: dbHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbHealthy ? 'connected' : 'disconnected'
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// =====================================================
// API ROUTES
// =====================================================

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Public routes (no authentication required)
app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/branding', brandingRoutes);
app.use('/api/pricing', pricingRoutes);

// Protected routes (authentication required)
app.use('/api/licenses', licenseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payees', payeeRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/signatures', signatureRoutes);

// =====================================================
// SERVE STATIC FILES (Frontend)
// =====================================================

// Serve the new React app for /app routes
app.use('/app', express.static(path.join(__dirname, '../public/app')));

// Serve legacy public files
app.use(express.static(path.join(__dirname, '../public')));

// React app - SPA routing (serve index.html for all /app/* routes)
app.get('/app/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/app/index.html'));
});

// Legacy PWA routes - serve index.html for all frontend routes
app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
        return next();
    }
    
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// =====================================================
// ERROR HANDLING
// =====================================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        code: 'NOT_FOUND',
        path: req.path
    });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('Unhandled error', { 
        error: err.message, 
        stack: err.stack,
        path: req.path
    });
    
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message,
        code: 'INTERNAL_ERROR'
    });
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
    logger.info(`🚀 FoodStream Ltd. White-Label Payment SAAS Server started`);
    logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🌐 Server running on http://localhost:${PORT}`);
    logger.info(`💾 Database: ${process.env.SUPABASE_URL ? 'Connected' : 'Not configured'}`);
    logger.info(`📱 SMS Provider: ${process.env.TWILIO_ACCOUNT_SID ? 'Configured' : 'Not configured'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    app.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

module.exports = app;
