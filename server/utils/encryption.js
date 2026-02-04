const crypto = require('crypto');

/**
 * Encryption Utility for sensitive data (SMS credentials, API keys)
 */
class EncryptionUtil {
    constructor() {
        this.algorithm = 'aes-256-cbc';
        this.key = Buffer.from(process.env.ENCRYPTION_KEY || this.generateDefaultKey(), 'hex');
    }
    
    /**
     * Generate default key (for development only)
     */
    generateDefaultKey() {
        console.warn('⚠️ WARNING: Using default encryption key. Set ENCRYPTION_KEY in production!');
        return crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * Encrypt data
     */
    encrypt(data) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
            
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            return {
                iv: iv.toString('hex'),
                data: encrypted
            };
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Encryption failed');
        }
    }
    
    /**
     * Decrypt data
     */
    decrypt(encryptedData) {
        try {
            const iv = Buffer.from(encryptedData.iv, 'hex');
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            
            let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Decryption failed');
        }
    }
    
    /**
     * Hash password with bcrypt
     */
    static async hashPassword(password) {
        const bcrypt = require('bcrypt');
        const saltRounds = 10;
        return await bcrypt.hash(password, saltRounds);
    }
    
    /**
     * Verify password
     */
    static async verifyPassword(password, hash) {
        const bcrypt = require('bcrypt');
        return await bcrypt.compare(password, hash);
    }
    
    /**
     * Generate random token
     */
    static generateToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    
    /**
     * Generate OTP
     */
    static generateOTP(length = 6) {
        const digits = '0123456789';
        let otp = '';
        
        for (let i = 0; i < length; i++) {
            otp += digits[Math.floor(Math.random() * 10)];
        }
        
        return otp;
    }
}

module.exports = new EncryptionUtil();
