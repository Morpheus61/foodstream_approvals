const { getSupabaseClient } = require('../config/database');
const LicenseGenerator = require('../utils/licenseGenerator');
const logger = require('../utils/logger');

/**
 * License Verification Middleware
 * Validates license key and enforces usage limits
 */
async function verifyLicense(req, res, next) {
    try {
        // Extract license key from headers or session
        const licenseKey = req.headers['x-license-key'] || 
                          req.session?.licenseKey ||
                          req.body?.licenseKey;
        
        if (!licenseKey) {
            return res.status(401).json({ 
                success: false,
                error: 'License key required',
                code: 'LICENSE_MISSING'
            });
        }
        
        // Format validation
        if (!LicenseGenerator.validateFormat(licenseKey)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid license key format',
                code: 'LICENSE_INVALID_FORMAT'
            });
        }
        
        const supabase = getSupabaseClient();
        
        // Fetch license from database
        const { data: license, error } = await supabase
            .from('licenses')
            .select('*')
            .eq('license_key', licenseKey)
            .single();
        
        if (error || !license) {
            await logVerification(null, 'invalid', req);
            return res.status(404).json({ 
                success: false,
                error: 'License not found',
                code: 'LICENSE_NOT_FOUND'
            });
        }
        
        // Status check
        if (license.status !== 'active') {
            await logVerification(license.id, license.status, req);
            return res.status(403).json({ 
                success: false,
                error: `License ${license.status}`,
                code: `LICENSE_${license.status.toUpperCase()}`
            });
        }
        
        // Expiry check
        if (license.expiry_date) {
            const expiryDate = new Date(license.expiry_date);
            const now = new Date();
            
            if (expiryDate < now) {
                // Auto-expire license
                await supabase
                    .from('licenses')
                    .update({ status: 'expired' })
                    .eq('id', license.id);
                
                await logVerification(license.id, 'expired', req);
                
                return res.status(403).json({ 
                    success: false,
                    error: 'License expired',
                    code: 'LICENSE_EXPIRED',
                    expiryDate: license.expiry_date
                });
            }
            
            // Warning for expiring soon (7 days)
            const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
            if (daysUntilExpiry <= 7) {
                res.setHeader('X-License-Warning', `License expires in ${daysUntilExpiry} days`);
            }
        }
        
        // Hardware lock check (if enabled)
        if (process.env.ENABLE_HARDWARE_LOCK === 'true' && license.hardware_id) {
            const currentHardwareId = LicenseGenerator.generateHardwareId(req);
            
            if (license.hardware_id !== currentHardwareId) {
                await logVerification(license.id, 'hardware_mismatch', req);
                
                return res.status(403).json({ 
                    success: false,
                    error: 'Hardware mismatch. Contact support to reset device binding.',
                    code: 'LICENSE_HARDWARE_MISMATCH'
                });
            }
        }
        
        // IP whitelist check (if enabled and configured)
        if (process.env.ENABLE_IP_WHITELIST === 'true' && 
            license.ip_whitelist && 
            license.ip_whitelist.length > 0) {
            
            const clientIp = req.ip || req.connection.remoteAddress;
            
            if (!license.ip_whitelist.includes(clientIp)) {
                await logVerification(license.id, 'ip_not_whitelisted', req);
                
                return res.status(403).json({ 
                    success: false,
                    error: 'IP address not whitelisted',
                    code: 'LICENSE_IP_RESTRICTED'
                });
            }
        }
        
        // Check usage limits (fetch current month usage)
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        const { data: usage } = await supabase
            .from('license_usage')
            .select('*')
            .eq('license_id', license.id)
            .eq('month', currentMonth)
            .single();
        
        if (usage) {
            // Check voucher limit
            if (license.max_vouchers_per_month > 0 && 
                usage.vouchers_count >= license.max_vouchers_per_month) {
                
                return res.status(429).json({ 
                    success: false,
                    error: 'Monthly voucher limit reached',
                    code: 'LICENSE_LIMIT_VOUCHERS',
                    limit: license.max_vouchers_per_month,
                    used: usage.vouchers_count
                });
            }
            
            // Check SMS credit limit
            if (license.sms_credits > 0 && usage.sms_sent >= license.sms_credits) {
                return res.status(429).json({ 
                    success: false,
                    error: 'SMS credits exhausted',
                    code: 'LICENSE_LIMIT_SMS',
                    limit: license.sms_credits,
                    used: usage.sms_sent
                });
            }
        }
        
        // Update last verified timestamp
        await supabase
            .from('licenses')
            .update({ last_verified: new Date().toISOString() })
            .eq('id', license.id);
        
        // Log successful verification
        await logVerification(license.id, 'success', req);
        
        // Attach license and usage to request
        req.license = license;
        req.licenseUsage = usage;
        
        // Store license key in session for future requests
        if (req.session) {
            req.session.licenseKey = licenseKey;
        }
        
        logger.info('License verified successfully', {
            licenseId: license.id,
            licenseeEmail: license.licensee_email,
            licenseType: license.license_type
        });
        
        next();
        
    } catch (error) {
        logger.error('License verification error', { error: error.message, stack: error.stack });
        
        res.status(500).json({ 
            success: false,
            error: 'License verification failed',
            code: 'LICENSE_VERIFICATION_ERROR'
        });
    }
}

/**
 * Log verification attempt
 */
async function logVerification(licenseId, status, req) {
    try {
        const supabase = getSupabaseClient();
        
        await supabase
            .from('license_verifications')
            .insert({
                license_id: licenseId,
                status: status,
                ip_address: req.ip || req.connection.remoteAddress,
                user_agent: req.headers['user-agent'],
                hardware_id: licenseId ? LicenseGenerator.generateHardwareId(req) : null,
                device_info: {
                    platform: req.headers['sec-ch-ua-platform'],
                    mobile: req.headers['sec-ch-ua-mobile']
                }
            });
        
        logger.license('verification_attempt', licenseId, { status, ip: req.ip });
    } catch (error) {
        logger.error('Failed to log license verification', { error: error.message });
    }
}

/**
 * Optional: Soft license check (doesn't block, only warns)
 */
async function softLicenseCheck(req, res, next) {
    try {
        await verifyLicense(req, res, next);
    } catch (error) {
        // Log but don't block
        logger.warn('Soft license check failed, allowing request', { error: error.message });
        next();
    }
}

module.exports = {
    verifyLicense,
    softLicenseCheck
};
