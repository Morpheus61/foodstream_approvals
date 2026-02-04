const jwt = require('jsonwebtoken');
const { getSupabaseClient } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Authentication Middleware
 * Verifies JWT tokens and user sessions
 */
async function authenticate(req, res, next) {
    try {
        // Extract token from header or cookie
        const token = extractToken(req);
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }
        
        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    success: false,
                    error: 'Token expired',
                    code: 'TOKEN_EXPIRED'
                });
            }
            
            return res.status(401).json({ 
                success: false,
                error: 'Invalid token',
                code: 'TOKEN_INVALID'
            });
        }
        
        const supabase = getSupabaseClient();
        
        // Fetch user from database
        const { data: user, error } = await supabase
            .from('users')
            .select('*, licensed_orgs!org_id(*)')
            .eq('id', decoded.userId)
            .eq('status', 'active')
            .single();
        
        if (error || !user) {
            return res.status(401).json({ 
                success: false,
                error: 'User not found or inactive',
                code: 'USER_NOT_FOUND'
            });
        }
        
        // Check if user is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return res.status(403).json({ 
                success: false,
                error: 'Account temporarily locked',
                code: 'ACCOUNT_LOCKED',
                lockedUntil: user.locked_until
            });
        }
        
        // Update last activity
        await supabase
            .from('users')
            .update({ 
                last_login: new Date().toISOString(),
                last_login_ip: req.ip
            })
            .eq('id', user.id);
        
        // Attach user to request
        req.user = user;
        req.orgId = user.org_id;
        
        logger.info('User authenticated', { 
            userId: user.id, 
            username: user.username,
            role: user.role 
        });
        
        next();
        
    } catch (error) {
        logger.error('Authentication error', { error: error.message });
        
        res.status(500).json({ 
            success: false,
            error: 'Authentication failed',
            code: 'AUTH_ERROR'
        });
    }
}

/**
 * Extract token from request
 */
function extractToken(req) {
    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        return req.headers.authorization.substring(7);
    }
    
    // Check cookie
    if (req.cookies && req.cookies.token) {
        return req.cookies.token;
    }
    
    // Check session
    if (req.session && req.session.token) {
        return req.session.token;
    }
    
    return null;
}

/**
 * Role-based authorization middleware
 */
function authorize(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            logger.security('unauthorized_access', 'medium', {
                userId: req.user.id,
                role: req.user.role,
                requiredRoles: allowedRoles,
                path: req.path
            });
            
            return res.status(403).json({ 
                success: false,
                error: 'Insufficient permissions',
                code: 'INSUFFICIENT_PERMISSIONS',
                requiredRoles: allowedRoles
            });
        }
        
        next();
    };
}

/**
 * Permission-based authorization
 */
function checkPermission(permission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }
        
        const userPermissions = req.user.permissions || {};
        
        if (!userPermissions[permission]) {
            return res.status(403).json({ 
                success: false,
                error: `Permission '${permission}' required`,
                code: 'PERMISSION_DENIED'
            });
        }
        
        next();
    };
}

/**
 * Optional authentication (doesn't block if not authenticated)
 */
async function optionalAuth(req, res, next) {
    try {
        await authenticate(req, res, next);
    } catch (error) {
        // Continue without authentication
        next();
    }
}

module.exports = {
    authenticate,
    authorize,
    checkPermission,
    optionalAuth
};
