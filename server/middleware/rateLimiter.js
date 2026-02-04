const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Rate Limiting Configuration
 * Protects against brute force and DDoS attacks
 */

// General API rate limit
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
    message: {
        success: false,
        error: 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.security('rate_limit_exceeded', 'medium', {
            ip: req.ip,
            path: req.path,
            user: req.user?.id
        });
        
        res.status(429).json({
            success: false,
            error: 'Too many requests, please try again later',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: req.rateLimit.resetTime
        });
    }
});

// Strict limit for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    skipSuccessfulRequests: true, // Don't count successful logins
    message: {
        success: false,
        error: 'Too many login attempts, account temporarily locked',
        code: 'AUTH_RATE_LIMIT'
    },
    handler: (req, res) => {
        logger.security('auth_rate_limit_exceeded', 'high', {
            ip: req.ip,
            username: req.body?.username,
            mobile: req.body?.mobile
        });
        
        res.status(429).json({
            success: false,
            error: 'Too many login attempts. Please try again in 15 minutes.',
            code: 'AUTH_RATE_LIMIT',
            retryAfter: req.rateLimit.resetTime
        });
    }
});

// OTP request limit
const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 3, // 3 OTP requests per window
    keyGenerator: (req) => {
        // Rate limit by mobile number
        return req.body?.mobile || req.ip;
    },
    message: {
        success: false,
        error: 'Too many OTP requests',
        code: 'OTP_RATE_LIMIT'
    },
    handler: (req, res) => {
        logger.security('otp_rate_limit_exceeded', 'medium', {
            mobile: req.body?.mobile,
            ip: req.ip
        });
        
        res.status(429).json({
            success: false,
            error: 'Too many OTP requests. Please try again in 10 minutes.',
            code: 'OTP_RATE_LIMIT',
            retryAfter: req.rateLimit.resetTime
        });
    }
});

// License activation limit (prevent brute force)
const licenseLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 attempts per hour
    keyGenerator: (req) => {
        return req.body?.licenseKey || req.ip;
    },
    message: {
        success: false,
        error: 'Too many license activation attempts',
        code: 'LICENSE_RATE_LIMIT'
    }
});

// Voucher creation limit (per user)
const voucherLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 vouchers per minute
    keyGenerator: (req) => {
        return req.user?.id || req.ip;
    },
    skipFailedRequests: true,
    message: {
        success: false,
        error: 'Voucher creation rate limit exceeded',
        code: 'VOUCHER_RATE_LIMIT'
    }
});

module.exports = {
    apiLimiter,
    authLimiter,
    otpLimiter,
    licenseLimiter,
    voucherLimiter
};
