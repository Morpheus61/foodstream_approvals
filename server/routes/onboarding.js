const express = require('express');
const router = express.Router();
const { getSupabaseClient } = require('../config/database');
const logger = require('../utils/logger');
const { generateLicenseKey } = require('../utils/licenseGenerator');

/**
 * Onboarding API
 * Handles license activation and free trial signup
 */

// =====================================================
// FREE TRIAL SIGNUP (No License Required!)
// =====================================================

/**
 * POST /api/onboarding/start-trial
 * Start a free trial - NO LICENSE KEY REQUIRED
 */
router.post('/start-trial', async (req, res) => {
    try {
        const {
            companyName,
            fullName,
            email,
            mobile,
            password,
            country,
            currency,
            planType = 'trial'
        } = req.body;

        // Validate required fields
        if (!companyName || !fullName || !email || !mobile || !password) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required'
            });
        }

        const supabase = getSupabaseClient();

        // Check if email already exists
        const { data: existingUser } = await supabase
            .from('users')
            .select('id')
            .eq('email', email.toLowerCase())
            .single();

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'An account with this email already exists'
            });
        }

        // Generate trial license key
        const licenseKey = generateLicenseKey('TRL');
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30); // 30 days trial

        // Create organization/tenant
        const { data: organization, error: orgError } = await supabase
            .from('organizations')
            .insert({
                name: companyName,
                status: 'trial',
                license_key: licenseKey,
                license_type: 'trial',
                license_expires_at: trialEndDate.toISOString(),
                country: country || 'HK',
                currency: currency || 'HKD',
                settings: {
                    plan: 'trial',
                    maxCompanies: 1,
                    maxUsers: 3,
                    maxVouchersPerMonth: 50,
                    smsCredits: 100
                }
            })
            .select()
            .single();

        if (orgError) {
            logger.error('Failed to create organization', { error: orgError.message });
            throw orgError;
        }

        // Create admin user (hashed password should be done in production)
        const { data: user, error: userError } = await supabase
            .from('users')
            .insert({
                organization_id: organization.id,
                email: email.toLowerCase(),
                full_name: fullName,
                mobile: mobile,
                password_hash: password, // In production, use bcrypt.hash()
                role: 'super_admin',
                status: 'active'
            })
            .select()
            .single();

        if (userError) {
            logger.error('Failed to create user', { error: userError.message });
            // Rollback organization creation
            await supabase.from('organizations').delete().eq('id', organization.id);
            throw userError;
        }

        // Create default company
        const { error: companyError } = await supabase
            .from('companies')
            .insert({
                organization_id: organization.id,
                name: companyName,
                is_default: true,
                status: 'active'
            });

        if (companyError) {
            logger.error('Failed to create company', { error: companyError.message });
        }

        // Log the trial signup
        logger.info('New trial signup', {
            email: email,
            company: companyName,
            country: country,
            currency: currency,
            licenseKey: licenseKey
        });

        res.json({
            success: true,
            message: 'Trial account created successfully!',
            licenseKey: licenseKey,
            trialEndsAt: trialEndDate.toISOString(),
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role
            },
            organization: {
                id: organization.id,
                name: organization.name,
                currency: organization.currency
            }
        });

    } catch (error) {
        logger.error('Trial signup failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to create trial account. Please try again.'
        });
    }
});

// =====================================================
// LICENSE ACTIVATION (For Paid Plans)
// =====================================================

/**
 * POST /api/onboarding/activate-license
 * Activate a purchased license key
 */
router.post('/activate-license', async (req, res) => {
    try {
        const {
            licenseKey,
            primaryContactEmail,
            primaryContactMobile,
            companyName
        } = req.body;

        if (!licenseKey || !primaryContactEmail || !primaryContactMobile) {
            return res.status(400).json({
                success: false,
                error: 'License key, email, and mobile are required'
            });
        }

        const supabase = getSupabaseClient();

        // Check if license exists and is valid
        const { data: license, error: licenseError } = await supabase
            .from('licenses')
            .select('*')
            .eq('license_key', licenseKey.toUpperCase())
            .single();

        if (licenseError || !license) {
            return res.status(404).json({
                success: false,
                error: 'Invalid license key'
            });
        }

        if (license.status === 'active') {
            return res.status(400).json({
                success: false,
                error: 'License is already activated'
            });
        }

        if (license.status === 'expired') {
            return res.status(400).json({
                success: false,
                error: 'License has expired'
            });
        }

        // Activate the license
        const { error: updateError } = await supabase
            .from('licenses')
            .update({
                status: 'active',
                activated_at: new Date().toISOString(),
                contact_email: primaryContactEmail,
                contact_mobile: primaryContactMobile
            })
            .eq('id', license.id);

        if (updateError) throw updateError;

        logger.info('License activated', {
            licenseKey: licenseKey,
            email: primaryContactEmail,
            plan: license.plan_type
        });

        res.json({
            success: true,
            message: 'License activated successfully!',
            license: {
                key: licenseKey,
                plan: license.plan_type,
                expiresAt: license.expires_at
            }
        });

    } catch (error) {
        logger.error('License activation failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to activate license'
        });
    }
});

/**
 * POST /api/onboarding/validate-license
 * Check if a license key is valid
 */
router.post('/validate-license', async (req, res) => {
    try {
        const { licenseKey } = req.body;

        if (!licenseKey) {
            return res.status(400).json({
                success: false,
                error: 'License key is required'
            });
        }

        const supabase = getSupabaseClient();

        const { data: license, error } = await supabase
            .from('licenses')
            .select('license_key, plan_type, status, expires_at')
            .eq('license_key', licenseKey.toUpperCase())
            .single();

        if (error || !license) {
            return res.json({
                success: true,
                valid: false,
                message: 'License key not found'
            });
        }

        res.json({
            success: true,
            valid: true,
            license: {
                plan: license.plan_type,
                status: license.status,
                expiresAt: license.expires_at
            }
        });

    } catch (error) {
        logger.error('License validation failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to validate license'
        });
    }
});

/**
 * GET /api/onboarding/pricing
 * Get pricing plans (public endpoint)
 */
router.get('/pricing', async (req, res) => {
    try {
        const currency = req.query.currency || 'HKD';
        
        // Exchange rates from HKD
        const exchangeRates = {
            HKD: 1,
            USD: 0.128,
            EUR: 0.118,
            GBP: 0.101,
            INR: 10.65,
            SGD: 0.172,
            AED: 0.47,
            AUD: 0.196,
            CNY: 0.918
        };

        const rate = exchangeRates[currency] || 1;
        const symbols = {
            HKD: 'HK$', USD: '$', EUR: '€', GBP: '£', INR: '₹',
            SGD: 'S$', AED: 'AED', AUD: 'A$', CNY: '¥'
        };

        const plans = [
            {
                code: 'trial',
                name: 'Trial',
                price: 0,
                displayPrice: `${symbols[currency] || currency} 0`,
                period: '30 days',
                features: {
                    companies: 1,
                    users: 3,
                    vouchersPerMonth: 50,
                    smsCredits: 100
                }
            },
            {
                code: 'basic',
                name: 'Basic',
                price: Math.round(720 * rate),
                displayPrice: `${symbols[currency] || currency} ${Math.round(720 * rate).toLocaleString()}`,
                period: 'monthly',
                features: {
                    companies: 3,
                    users: 10,
                    vouchersPerMonth: 500,
                    smsCredits: 1000
                }
            },
            {
                code: 'premium',
                name: 'Premium',
                price: Math.round(1920 * rate),
                displayPrice: `${symbols[currency] || currency} ${Math.round(1920 * rate).toLocaleString()}`,
                period: 'monthly',
                features: {
                    companies: 10,
                    users: 50,
                    vouchersPerMonth: 2000,
                    smsCredits: 5000
                }
            },
            {
                code: 'enterprise',
                name: 'Enterprise',
                price: null,
                displayPrice: 'Custom',
                period: 'monthly',
                features: {
                    companies: 'Unlimited',
                    users: 'Unlimited',
                    vouchersPerMonth: 'Unlimited',
                    smsCredits: 'Unlimited'
                }
            }
        ];

        res.json({
            success: true,
            currency: currency,
            symbol: symbols[currency] || currency,
            plans: plans
        });

    } catch (error) {
        logger.error('Failed to fetch pricing', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pricing information'
        });
    }
});

module.exports = router;
