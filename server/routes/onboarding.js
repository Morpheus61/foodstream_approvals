const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { getSupabaseClient } = require('../config/database');
const logger = require('../utils/logger');
const LicenseGenerator = require('../utils/licenseGenerator');
const encryptionUtil = require('../utils/encryption');

/**
 * Onboarding API
 * Handles license activation and free trial signup
 *
 * Database tables used:
 *   licenses       — license records
 *   licensed_orgs  — tenant organizations
 *   users          — user accounts (requires username, password_hash)
 *   companies      — companies within an org
 *   license_usage  — monthly usage tracking
 */

// =====================================================
// HELPERS
// =====================================================

async function generateUniqueUsername(supabase, email) {
    let base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (base.length < 3) base = base + 'user';
    let username = base;
    let suffix = 0;
    while (true) {
        const { data: existing } = await supabase
            .from('users').select('id').eq('username', username).single();
        if (!existing) return username;
        suffix++;
        username = `${base}${suffix}`;
    }
}

async function generateOrgSlug(supabase, companyName) {
    let base = companyName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 50);
    if (base.length < 3) base = base + '-org';
    let slug = base;
    let suffix = 0;
    while (true) {
        const { data: existing } = await supabase
            .from('licensed_orgs').select('id').eq('org_slug', slug).single();
        if (!existing) return slug;
        suffix++;
        slug = `${base}-${suffix}`;
    }
}

// =====================================================
// FREE TRIAL SIGNUP
// =====================================================

/**
 * POST /api/onboarding/start-trial
 * Creates: license → licensed_org → user → company → license_usage
 */
router.post('/start-trial', async (req, res) => {
    try {
        const {
            companyName, fullName, email, mobile, password,
            country, currency, planType = 'trial'
        } = req.body;

        if (!companyName || !fullName || !email || !mobile || !password) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
        }

        // Sanitize mobile: strip spaces/dashes, limit to 20 chars for VARCHAR(20)
        const sanitizedMobile = mobile.replace(/[\s\-()]/g, '').substring(0, 20);
        if (!sanitizedMobile) {
            return res.status(400).json({ success: false, error: 'Valid mobile number is required' });
        }

        const supabase = getSupabaseClient();

        // Verify database connectivity before proceeding
        const { error: healthError } = await supabase.from('licenses').select('id').limit(1);
        if (healthError) {
            logger.error('Database connectivity check failed', {
                message: healthError.message,
                code: healthError.code,
                details: healthError.details,
                hint: healthError.hint
            });
            return res.status(503).json({
                success: false,
                error: 'Database connection error: ' + (healthError.message || healthError.code || 'Unknown'),
                debug: {
                    code: healthError.code,
                    details: healthError.details,
                    hint: healthError.hint,
                    supabaseUrl: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET',
                    serviceKey: process.env.SUPABASE_SERVICE_KEY ? 'SET (' + process.env.SUPABASE_SERVICE_KEY.substring(0, 20) + '...)' : 'NOT SET'
                }
            });
        }

        // Check duplicate email
        const { data: existingUser } = await supabase
            .from('users').select('id').eq('email', email.toLowerCase()).single();
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'An account with this email already exists' });
        }

        // 1. Generate license key
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30);
        const licenseKey = LicenseGenerator.generateKey(email.toLowerCase(), 'trial', trialEndDate.toISOString());

        // 2. Create license record
        const now = new Date().toISOString();
        const licensePayload = {
            license_key: licenseKey,
            license_type: 'trial',
            licensee_name: fullName.substring(0, 255),
            licensee_email: email.toLowerCase().substring(0, 255),
            licensee_mobile: sanitizedMobile,
            licensee_company: companyName.substring(0, 255),
            status: 'active',
            max_companies: 1,
            max_users: 3,
            max_vouchers_per_month: 50,
            sms_credits: 100,
            issued_date: now,
            activation_date: now,
            expiry_date: trialEndDate.toISOString(),
            features: {
                print: true,
                reports: true,
                api_access: false,
                custom_domain: false,
                white_label: true,
                multi_company: false,
                advanced_analytics: false
            }
        };

        logger.info('Attempting license creation', { email: email.toLowerCase(), licenseKey, mobile: sanitizedMobile });

        const { data: license, error: licenseError } = await supabase
            .from('licenses')
            .insert(licensePayload)
            .select()
            .single();

        if (licenseError) {
            logger.error('License creation failed', {
                message: licenseError.message,
                code: licenseError.code,
                details: licenseError.details,
                hint: licenseError.hint,
                status: licenseError.status,
                payload: { ...licensePayload, license_key: '***' }
            });
            throw new Error('Failed to create license: ' + (licenseError.message || licenseError.code || 'Unknown database error'));
        }

        if (!license || !license.id) {
            logger.error('License creation returned no data', { licenseError, license });
            throw new Error('Failed to create license: No data returned from database');
        }

        // 3. Create organization (licensed_orgs)
        const orgSlug = await generateOrgSlug(supabase, companyName);
        const { data: org, error: orgError } = await supabase
            .from('licensed_orgs')
            .insert({
                license_id: license.id,
                org_name: companyName,
                org_slug: orgSlug,
                primary_contact_name: fullName,
                primary_contact_email: email.toLowerCase(),
                primary_contact_mobile: sanitizedMobile,
                country: country || 'HK',
                currency: currency || 'HKD',
                status: 'active',
                onboarding_completed: false,
                onboarding_step: 1
            })
            .select().single();
        if (orgError) {
            logger.error('Organization creation failed', {
                message: orgError.message, code: orgError.code,
                details: orgError.details, hint: orgError.hint
            });
            await supabase.from('licenses').delete().eq('id', license.id);
            throw new Error('Failed to create organization: ' + (orgError.message || 'Unknown error'));
        }

        // 4. Create admin user (password hashed with bcrypt)
        const passwordHash = await encryptionUtil.hashPassword(password);
        const username = await generateUniqueUsername(supabase, email);
        const { data: user, error: userError } = await supabase
            .from('users')
            .insert({
                org_id: org.id,
                username: username,
                full_name: fullName,
                email: email.toLowerCase(),
                mobile: sanitizedMobile,
                password_hash: passwordHash,
                role: 'org_admin',
                status: 'active'
            })
            .select().single();
        if (userError) {
            logger.error('User creation failed', {
                message: userError.message, code: userError.code,
                details: userError.details, hint: userError.hint
            });
            await supabase.from('licensed_orgs').delete().eq('id', org.id);
            await supabase.from('licenses').delete().eq('id', license.id);
            throw new Error('Failed to create user: ' + (userError.message || 'Unknown error'));
        }

        // 5. Create default company
        const { data: company } = await supabase
            .from('companies')
            .insert({ org_id: org.id, name: companyName, country: country || 'HK', status: 'active', created_by: user.id })
            .select().single();
        if (company) {
            await supabase.from('users').update({ company_id: company.id }).eq('id', user.id);
        }

        // 6. Initialize license usage
        const currentMonth = new Date().toISOString().slice(0, 7);
        await supabase.from('license_usage').insert({
            license_id: license.id, month: currentMonth,
            companies_count: 1, users_count: 1, vouchers_count: 0, sms_sent: 0
        });

        logger.info('New trial signup', { email, username, licenseKey, orgId: org.id });

        res.json({
            success: true,
            message: 'Trial account created successfully!',
            licenseKey: licenseKey,
            username: username,
            trialEndsAt: trialEndDate.toISOString(),
            user: { id: user.id, username, email: user.email, fullName: user.full_name, role: user.role },
            organization: { id: org.id, name: org.org_name, currency: org.currency }
        });

    } catch (error) {
        logger.error('Trial signup failed', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, error: error.message || 'Failed to create trial account' });
    }
});

// =====================================================
// LICENSE ACTIVATION (For Paid Plans)
// =====================================================

/**
 * POST /api/onboarding/activate-license
 * Activate a purchased license key and create org/user/company
 */
router.post('/activate-license', async (req, res) => {
    try {
        const {
            licenseKey,
            primaryContactEmail,
            password
        } = req.body;

        if (!licenseKey || !primaryContactEmail || !password) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required: licenseKey, email, password'
            });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
        }

        const supabase = getSupabaseClient();

        // 1. Validate the license key format
        if (!LicenseGenerator.validateFormat(licenseKey.toUpperCase())) {
            return res.status(400).json({ success: false, error: 'Invalid license key format' });
        }

        // 2. Look up the license
        const { data: license, error: licenseError } = await supabase
            .from('licenses')
            .select('*')
            .eq('license_key', licenseKey.toUpperCase())
            .single();

        if (licenseError || !license) {
            return res.status(404).json({ success: false, error: 'Invalid license key. Please check and try again.' });
        }

        if (license.status === 'active') {
            // License already activated — try to log the user in with provided credentials
            const { data: existingUser } = await supabase
                .from('users')
                .select('*')
                .eq('email', primaryContactEmail.toLowerCase())
                .eq('status', 'active')
                .single();

            if (!existingUser) {
                return res.status(400).json({ success: false, error: 'This license is already activated. Please use the Login page to sign in.' });
            }

            const isValid = await encryptionUtil.verifyPassword(password, existingUser.password_hash);
            if (!isValid) {
                return res.status(401).json({ success: false, error: 'This license is already activated. Incorrect password — please use Login instead.' });
            }

            // Fetch org info
            let org = null;
            if (existingUser.org_id) {
                const { data: orgData } = await supabase
                    .from('licensed_orgs')
                    .select('*')
                    .eq('id', existingUser.org_id)
                    .single();
                org = orgData;
            }

            // Generate JWT
            const token = jwt.sign(
                { userId: existingUser.id, orgId: existingUser.org_id, role: existingUser.role },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            logger.info('Already-activated license login', { licenseKey, email: primaryContactEmail, username: existingUser.username });

            return res.json({
                success: true,
                alreadyActivated: true,
                message: 'License already activated — logged in successfully!',
                token,
                username: existingUser.username,
                user: {
                    id: existingUser.id,
                    username: existingUser.username,
                    fullName: existingUser.full_name,
                    role: existingUser.role,
                    orgId: existingUser.org_id,
                    org: org
                },
                license: {
                    key: licenseKey.toUpperCase(),
                    plan: license.license_type,
                    status: license.status,
                    expiresAt: license.expiry_date,
                    activatedAt: license.activation_date
                }
            });
        }
        if (license.status === 'expired') {
            return res.status(400).json({ success: false, error: 'This license has expired' });
        }
        if (license.status === 'revoked' || license.status === 'suspended') {
            return res.status(400).json({ success: false, error: 'This license has been ' + license.status });
        }

        // Verify email matches the one stored in the license record
        if (license.licensee_email && license.licensee_email.toLowerCase() !== primaryContactEmail.toLowerCase()) {
            return res.status(400).json({ success: false, error: 'Email does not match the email associated with this license key' });
        }

        // Pull company name, full name, and mobile from the license record (entered by admin at license creation)
        const companyName = license.licensee_company || 'My Company';
        const fullName = license.licensee_name || primaryContactEmail.split('@')[0];
        const sanitizedMobile = (license.licensee_mobile || '').replace(/[\s\-()]/g, '').substring(0, 20);

        // Check duplicate email
        const { data: existingUser } = await supabase
            .from('users').select('id').eq('email', primaryContactEmail.toLowerCase()).single();
        if (existingUser) {
            return res.status(400).json({ success: false, error: 'An account with this email already exists' });
        }

        // 3. Activate the license
        const { error: updateError } = await supabase
            .from('licenses')
            .update({
                status: 'active',
                activation_date: new Date().toISOString(),
                licensee_name: fullName,
                licensee_email: primaryContactEmail.toLowerCase(),
                licensee_mobile: sanitizedMobile,
                licensee_company: companyName
            })
            .eq('id', license.id);
        if (updateError) {
            logger.error('License activation update failed', {
                message: updateError.message, code: updateError.code,
                details: updateError.details, hint: updateError.hint
            });
            throw new Error('Failed to activate license: ' + (updateError.message || 'Unknown error'));
        }

        // 4. Create organization
        const orgSlug = await generateOrgSlug(supabase, companyName);
        const { data: org, error: orgError } = await supabase
            .from('licensed_orgs')
            .insert({
                license_id: license.id,
                org_name: companyName,
                org_slug: orgSlug,
                primary_contact_name: fullName,
                primary_contact_email: primaryContactEmail.toLowerCase(),
                primary_contact_mobile: sanitizedMobile,
                country: 'HK',
                currency: 'HKD',
                status: 'active',
                onboarding_completed: false,
                onboarding_step: 1
            })
            .select().single();
        if (orgError) {
            logger.error('Organization creation failed (activation)', {
                message: orgError.message, code: orgError.code,
                details: orgError.details, hint: orgError.hint
            });
            throw new Error('Failed to create organization: ' + (orgError.message || 'Unknown error'));
        }

        // 5. Create admin user
        const passwordHash = await encryptionUtil.hashPassword(password);
        const username = await generateUniqueUsername(supabase, primaryContactEmail);
        const { data: user, error: userError } = await supabase
            .from('users')
            .insert({
                org_id: org.id,
                username: username,
                full_name: fullName,
                email: primaryContactEmail.toLowerCase(),
                mobile: sanitizedMobile,
                password_hash: passwordHash,
                role: 'super_admin',
                status: 'active'
            })
            .select().single();
        if (userError) {
            logger.error('User creation failed (activation)', {
                message: userError.message, code: userError.code,
                details: userError.details, hint: userError.hint
            });
            throw new Error('Failed to create user: ' + (userError.message || 'Unknown error'));
        }

        // 6. Create default company
        const { data: company } = await supabase
            .from('companies')
            .insert({ org_id: org.id, name: companyName, country: 'HK', status: 'active', created_by: user.id })
            .select().single();
        if (company) {
            await supabase.from('users').update({ company_id: company.id }).eq('id', user.id);
        }

        // 7. Initialize license usage
        const currentMonth = new Date().toISOString().slice(0, 7);
        await supabase.from('license_usage').insert({
            license_id: license.id, month: currentMonth,
            companies_count: 1, users_count: 1, vouchers_count: 0, sms_sent: 0
        });

        logger.info('License activated', { licenseKey, email: primaryContactEmail, username, plan: license.license_type });

        res.json({
            success: true,
            message: 'License activated successfully!',
            username: username,
            license: {
                key: licenseKey.toUpperCase(),
                plan: license.license_type,
                expiresAt: license.expiry_date
            },
            user: { id: user.id, username, email: user.email, fullName: user.full_name, role: user.role },
            organization: { id: org.id, name: org.org_name }
        });

    } catch (error) {
        logger.error('License activation failed', { error: error.message, stack: error.stack });
        res.status(500).json({ success: false, error: error.message || 'Failed to activate license' });
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
            return res.status(400).json({ success: false, error: 'License key is required' });
        }

        // Format validation first
        if (!LicenseGenerator.validateFormat(licenseKey.toUpperCase())) {
            return res.json({ success: true, valid: false, message: 'Invalid license key format' });
        }

        const supabase = getSupabaseClient();

        const { data: license, error } = await supabase
            .from('licenses')
            .select('license_key, license_type, status, expiry_date')
            .eq('license_key', licenseKey.toUpperCase())
            .single();

        if (error || !license) {
            return res.json({ success: true, valid: false, message: 'License key not found' });
        }

        // Check expiry
        const isExpired = license.expiry_date && new Date(license.expiry_date) < new Date();

        res.json({
            success: true,
            valid: !isExpired && license.status !== 'revoked',
            license: {
                plan: license.license_type,
                status: isExpired ? 'expired' : license.status,
                expiresAt: license.expiry_date
            }
        });

    } catch (error) {
        logger.error('License validation failed', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to validate license' });
    }
});

/**
 * GET /api/onboarding/pricing
 * Get pricing plans (public endpoint)
 */
router.get('/pricing', async (req, res) => {
    try {
        const currency = req.query.currency || 'HKD';
        const supabase = getSupabaseClient();

        // Try to fetch plans from database
        let basePrices = { trial: 0, basic: 100, premium: 799, enterprise: 1999 };
        let planFeatures = {
            trial: { companies: 1, users: 3, vouchersPerMonth: 50, smsCredits: 100 },
            basic: { companies: 3, users: 10, vouchersPerMonth: 500, smsCredits: 1000 },
            premium: { companies: 10, users: 50, vouchersPerMonth: 2000, smsCredits: 5000 },
            enterprise: { companies: 'Unlimited', users: 'Unlimited', vouchersPerMonth: 'Unlimited', smsCredits: 'Unlimited' }
        };

        try {
            const { data: dbPlans } = await supabase
                .from('pricing_plans')
                .select('code, name, base_price_hkd, max_companies, max_users, max_vouchers_per_month, sms_credits_included')
                .eq('status', 'active')
                .order('base_price_hkd', { ascending: true });

            if (dbPlans && dbPlans.length > 0) {
                dbPlans.forEach(p => {
                    const code = p.code.toLowerCase();
                    basePrices[code] = p.base_price_hkd || basePrices[code] || 0;
                    planFeatures[code] = {
                        companies: p.max_companies || planFeatures[code]?.companies,
                        users: p.max_users || planFeatures[code]?.users,
                        vouchersPerMonth: p.max_vouchers_per_month || planFeatures[code]?.vouchersPerMonth,
                        smsCredits: p.sms_credits_included || planFeatures[code]?.smsCredits
                    };
                });
            }
        } catch (dbErr) {
            logger.warn('Could not fetch pricing from DB, using defaults', { error: dbErr.message });
        }

        // Exchange rates from HKD
        const exchangeRates = {
            HKD: 1, USD: 0.128, EUR: 0.118, GBP: 0.101, INR: 10.65,
            SGD: 0.172, AED: 0.47, AUD: 0.196, CNY: 0.918
        };
        const symbols = {
            HKD: 'HK$', USD: '$', EUR: '€', GBP: '£', INR: '₹',
            SGD: 'S$', AED: 'AED', AUD: 'A$', CNY: '¥'
        };

        const rate = exchangeRates[currency] || 1;
        const symbol = symbols[currency] || currency;

        const plans = Object.entries(basePrices).map(([code, price]) => ({
            code,
            name: code.charAt(0).toUpperCase() + code.slice(1),
            price: price === 0 ? 0 : Math.round(price * rate),
            displayPrice: price === 0 ? `${symbol} 0` : `${symbol} ${Math.round(price * rate).toLocaleString()}`,
            period: code === 'trial' ? '30 days' : 'monthly',
            features: planFeatures[code] || {}
        }));

        res.json({ success: true, currency, symbol, plans });

    } catch (error) {
        logger.error('Failed to fetch pricing', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to fetch pricing information' });
    }
});

// =====================================================
// DATABASE HEALTH CHECK (Debug endpoint)
// =====================================================

/**
 * GET /api/onboarding/health
 * Check database connectivity and table access
 */
router.get('/health', async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const results = {};

        // Test each critical table
        const tables = ['licenses', 'licensed_orgs', 'users', 'companies', 'license_usage'];
        for (const table of tables) {
            const { data, error } = await supabase.from(table).select('id').limit(1);
            results[table] = {
                accessible: !error,
                error: error ? { message: error.message, code: error.code, hint: error.hint } : null,
                rowCount: data ? data.length : 0
            };
        }

        // Test insert capability on licenses (dry run via select with impossible filter)
        const allAccessible = Object.values(results).every(r => r.accessible);

        res.json({
            success: true,
            database: allAccessible ? 'connected' : 'partial',
            supabaseUrl: process.env.SUPABASE_URL || 'NOT SET',
            serviceKey: process.env.SUPABASE_SERVICE_KEY ? '✓ set (role: service_role)' : '✗ NOT SET',
            tables: results
        });

    } catch (error) {
        logger.error('Health check failed', { error: error.message });
        res.status(500).json({
            success: false,
            database: 'disconnected',
            error: error.message,
            supabaseUrl: process.env.SUPABASE_URL || 'NOT SET',
            serviceKey: process.env.SUPABASE_SERVICE_KEY ? '✓ set' : '✗ NOT SET'
        });
    }
});

module.exports = router;
