const winston = require('winston');
const path = require('path');

/**
 * Logger Configuration
 * Structured logging for the application
 */

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console format (for development)
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        
        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
        }
        
        return msg;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'payment-approval-saas' },
    transports: [
        // Write all logs to console
        new winston.transports.Console({
            format: consoleFormat
        }),
        
        // Write all logs with importance level of 'error' or less to error.log
        new winston.transports.File({ 
            filename: path.join(__dirname, '../../logs/error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        
        // Write all logs to combined.log
        new winston.transports.File({ 
            filename: path.join(__dirname, '../../logs/combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 10
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({ 
            filename: path.join(__dirname, '../../logs/exceptions.log')
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({ 
            filename: path.join(__dirname, '../../logs/rejections.log')
        })
    ]
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Custom log methods for specific use cases
 */

logger.audit = (action, userId, metadata = {}) => {
    logger.info('AUDIT', {
        action,
        userId,
        timestamp: new Date().toISOString(),
        ...metadata
    });
};

logger.security = (event, severity, metadata = {}) => {
    logger.warn('SECURITY', {
        event,
        severity,
        timestamp: new Date().toISOString(),
        ...metadata
    });
};

logger.license = (action, licenseId, metadata = {}) => {
    logger.info('LICENSE', {
        action,
        licenseId,
        timestamp: new Date().toISOString(),
        ...metadata
    });
};

module.exports = logger;
