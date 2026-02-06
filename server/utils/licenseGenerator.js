const crypto = require('crypto');

/**
 * License Key Generator
 * Generates and validates license keys for the white-label system
 */
class LicenseGenerator {
    /**
     * Generate a unique license key
     * Format: [PREFIX]-[TIMESTAMP]-[RANDOM1]-[RANDOM2]-[CHECKSUM]
     * Example: PRM-4XY9Z-8K2L4-M7N3P-C4F6
     */
    static generateKey(licenseeEmail, licenseType, expiryDate) {
        // Prefix based on license type
        const prefix = {
            'trial': 'TRL',
            'basic': 'BSC',
            'premium': 'PRM',
            'enterprise': 'ENT'
        }[licenseType] || 'GEN';
        
        // Timestamp component (5 chars, base36)
        const timestamp = Date.now().toString(36).toUpperCase().slice(-5);
        
        // Random components (10 chars hex, split into 2 parts)
        const random = crypto.randomBytes(5).toString('hex').toUpperCase();
        const part1 = random.slice(0, 5);
        const part2 = random.slice(5, 9);
        
        // Checksum (4 chars)
        const checksum = this.calculateChecksum(licenseeEmail, expiryDate);
        
        return `${prefix}-${timestamp}-${part1}-${part2}-${checksum}`;
    }
    
    /**
     * Validate license key format
     */
    static validateFormat(licenseKey) {
        // Pattern: XXX-XXXXX-XXXXX-XXXX-XXXX
        const pattern = /^[A-Z]{3}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
        return pattern.test(licenseKey);
    }
    
    /**
     * Calculate checksum for validation
     */
    static calculateChecksum(email, expiryDate) {
        const secret = process.env.LICENSE_SECRET || 'default-secret-change-in-production';
        const data = `${email}|${expiryDate}|${secret}`;
        
        const hash = crypto.createHash('sha256')
            .update(data)
            .digest('hex');
        
        return hash.slice(0, 4).toUpperCase();
    }
    
    /**
     * Generate hardware fingerprint from request
     */
    static generateHardwareId(req) {
        const os = require('os');
        
        const components = [
            os.cpus()[0]?.model || 'unknown-cpu',
            os.totalmem().toString(),
            os.platform(),
            req.headers['user-agent'] || 'unknown-agent'
        ];
        
        return crypto.createHash('sha256')
            .update(components.join('|'))
            .digest('hex');
    }
    
    /**
     * Generate activation token for offline activation
     */
    static generateActivationToken(licenseKey, hardwareId) {
        const secret = process.env.LICENSE_SECRET || 'default-secret';
        const data = `${licenseKey}|${hardwareId}`;
        
        const token = crypto.createHmac('sha256', secret)
            .update(data)
            .digest('hex');
        
        return token.toUpperCase();
    }
    
    /**
     * Verify activation token
     */
    static verifyActivationToken(licenseKey, hardwareId, token) {
        const expectedToken = this.generateActivationToken(licenseKey, hardwareId);
        
        return crypto.timingSafeEqual(
            Buffer.from(token),
            Buffer.from(expectedToken)
        );
    }
    
    /**
     * Generate trial license with automatic expiry
     */
    static generateTrialLicense(email, name, mobile) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30); // 30 days trial
        
        const licenseKey = this.generateKey(email, 'trial', expiryDate.toISOString());
        
        return {
            licenseKey,
            licenseType: 'trial',
            licenseeName: name,
            licenseeEmail: email,
            licenseeMobile: mobile,
            issuedDate: new Date(),
            expiryDate: expiryDate,
            maxCompanies: 1,
            maxUsers: 3,
            maxVouchersPerMonth: 50,
            smsCredits: 100,
            features: {
                print: true,
                reports: false,
                api_access: false,
                custom_domain: false,
                white_label: true,
                multi_company: false
            }
        };
    }
}

module.exports = LicenseGenerator;
module.exports.LicenseGenerator = LicenseGenerator;
