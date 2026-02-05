const winston = require('winston');
const path = require('path');
const fs = require('fs');

/**
 * Logger Configuration
 * Structured logging for the application
 * Handles both local development and serverless environments (Vercel)
 */

// Check if we're in a serverless environment (Vercel has read-only filesystem)
const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTIONS_WORKER_RUNTIME;

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

// Build transports array based on environment
const transports = [
    // Always write to console (works in all environments)
    new winston.transports.Console({
        format: consoleFormat
    })
];

// Only add file transports in non-serverless environments
if (!isServerless) {
    const logsDir = path.join(__dirname, '../../logs');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
        try {
            fs.mkdirSync(logsDir, { recursive: true });
        } catch (err) {
            console.warn('Could not create logs directory:', err.message);
        }
    }
    
    // Only add file transports if directory exists and is writable
    if (fs.existsSync(logsDir)) {
        transports.push(
            // Write all logs with importance level of 'error' or less to error.log
            new winston.transports.File({ 
                filename: path.join(logsDir, 'error.log'),
                level: 'error',
                maxsize: 5242880, // 5MB
                maxFiles: 5
            }),
            // Write all logs to combined.log
            new winston.transports.File({ 
                filename: path.join(logsDir, 'combined.log'),
                maxsize: 5242880, // 5MB
                maxFiles: 10
            })
        );
    }
}

// Create logger instance
const loggerConfig = {
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'payment-approval-saas' },
    transports
};

// Only add exception/rejection handlers with file transports in non-serverless environments
if (!isServerless) {
    const logsDir = path.join(__dirname, '../../logs');
    if (fs.existsSync(logsDir)) {
        loggerConfig.exceptionHandlers = [
            new winston.transports.File({ 
                filename: path.join(logsDir, 'exceptions.log')
            })
        ];
        loggerConfig.rejectionHandlers = [
            new winston.transports.File({ 
                filename: path.join(logsDir, 'rejections.log')
            })
        ];
    }
}

const logger = winston.createLogger(loggerConfig);

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
