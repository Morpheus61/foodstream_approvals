const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getSupabaseClient } = require('../config/database');
const encryptionUtil = require('../utils/encryption');
const { authLimiter, otpLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');
const SMSService = require('../services/smsService');

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { username, fullName, email, mobile, password, orgId, role } = req.body;
        
        const supabase = getSupabaseClient();
        
        // Check if user exists
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('username', username)
            .single();
        
        if (existing) {
            return res.status(400).json({ success: false, error: 'Username already exists' });
        }
        
        // Hash password
        const passwordHash = await encryptionUtil.hashPassword(password);
        
        // Create user
        const { data: user, error } = await supabase
            .from('users')
            .insert({
                username,
                full_name: fullName,
                email,
                mobile,
                password_hash: passwordHash,
                org_id: orgId,
                role: role || 'accounts'
            })
            .select()
            .single();
        
        if (error) throw error;
        
        logger.audit('user_registered', user.id, { username, role });
        
        res.json({ success: true, user: { id: user.id, username: user.username } });
    } catch (error) {
        logger.error('Registration error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Username and password are required' });
        }
        
        const supabase = getSupabaseClient();
        
        // Use left join (licensed_orgs) instead of inner join (licensed_orgs!org_id)
        // This ensures users without an org can still log in (e.g., super_admin)
        const { data: user, error } = await supabase
            .from('users')
            .select('*, licensed_orgs(*)') 
            .eq('username', username)
            .eq('status', 'active')
            .single();
        
        if (error) {
            logger.error('Database query error', { error: error.message, code: error.code });
            return res.status(401).json({ success: false, error: 'Invalid credentials', debug: 'db_error' });
        }
        
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials', debug: 'no_user' });
        }
        
        const isValid = await encryptionUtil.verifyPassword(password, user.password_hash);
        
        if (!isValid) {
            logger.error('Password verification failed', { username, hashPrefix: user.password_hash?.substring(0, 10) });
            return res.status(401).json({ success: false, error: 'Invalid credentials', debug: 'pwd_fail' });
        }
        
        // Check JWT_SECRET is configured
        if (!process.env.JWT_SECRET) {
            logger.error('JWT_SECRET is not configured');
            return res.status(500).json({ success: false, error: 'Server configuration error' });
        }
        
        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, orgId: user.org_id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        // Update last login (non-blocking, don't fail login if this fails)
        try {
            await supabase
                .from('users')
                .update({ last_login: new Date().toISOString(), last_login_ip: req.ip })
                .eq('id', user.id);
        } catch (updateError) {
            logger.error('Failed to update last login', { error: updateError.message });
        }
        
        logger.audit('user_login', user.id, { username });
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                role: user.role,
                orgId: user.org_id,
                org: user.licensed_orgs
            }
        });
    } catch (error) {
        logger.error('Login error', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
    }
});

// POST /api/auth/otp/send
router.post('/otp/send', otpLimiter, async (req, res) => {
    try {
        const { mobile, otpType, orgId } = req.body;
        
        const otp = encryptionUtil.generateOTP(6);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        
        const supabase = getSupabaseClient();
        
        // Store OTP
        await supabase
            .from('otp_verifications')
            .insert({
                mobile,
                otp_code: otp,
                otp_type: otpType,
                org_id: orgId,
                expires_at: expiresAt.toISOString()
            });
        
        // Send SMS
        const smsService = await SMSService.forOrganization(orgId);
        if (smsService) {
            await smsService.sendOTP(mobile, 'otp_registration', [otp, '10 min', 'CompanyName']);
        }
        
        logger.info('OTP sent', { mobile, otpType });
        
        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (error) {
        logger.error('OTP send error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/auth/otp/verify
router.post('/otp/verify', async (req, res) => {
    try {
        const { mobile, otp } = req.body;
        
        const supabase = getSupabaseClient();
        
        const { data, error } = await supabase
            .from('otp_verifications')
            .select('*')
            .eq('mobile', mobile)
            .eq('otp_code', otp)
            .eq('verified', false)
            .gte('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (error || !data) {
            return res.status(400).json({ success: false, error: 'Invalid or expired OTP' });
        }
        
        // Mark as verified
        await supabase
            .from('otp_verifications')
            .update({ verified: true, verified_at: new Date().toISOString() })
            .eq('id', data.id);
        
        logger.info('OTP verified', { mobile });
        
        res.json({ success: true, message: 'OTP verified successfully' });
    } catch (error) {
        logger.error('OTP verify error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
