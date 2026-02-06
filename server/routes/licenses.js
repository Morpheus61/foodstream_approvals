const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getSupabaseClient } = require('../config/database');
const LicenseGenerator = require('../utils/licenseGenerator');
const logger = require('../utils/logger');

// =====================================================
// LIST ALL LICENSES
// =====================================================

/**
 * GET /api/licenses
 * List all licenses with filtering & pagination
 * Admin only
 */
router.get('/', authenticate, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { status, type, search, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = supabase
            .from('licenses')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        if (status) query = query.eq('status', status);
        if (type) query = query.eq('license_type', type);
        if (search) {
            query = query.or(`license_key.ilike.%${search}%,licensee_email.ilike.%${search}%,licensee_name.ilike.%${search}%,licensee_company.ilike.%${search}%`);
        }

        const { data: licenses, error, count } = await query;

        if (error) throw error;

        res.json({
            success: true,
            licenses: licenses || [],
            pagination: {
                total: count || 0,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil((count || 0) / parseInt(limit))
            }
        });

    } catch (error) {
        logger.error('Failed to list licenses', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to fetch licenses' });
    }
});

// =====================================================
// GET LICENSE BY ID
// =====================================================

/**
 * GET /api/licenses/:id
 * Get a single license with usage data
 */
router.get('/:id', authenticate, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();

        const { data: license, error } = await supabase
            .from('licenses')
            .select('*, license_usage(*)')
            .eq('id', req.params.id)
            .single();

        if (error || !license) {
            return res.status(404).json({ success: false, error: 'License not found' });
        }

        // Also fetch the org if linked
        const { data: org } = await supabase
            .from('licensed_orgs')
            .select('id, org_name, org_slug, status')
            .eq('license_id', license.id)
            .single();

        res.json({
            success: true,
            license: { ...license, organization: org || null }
        });

    } catch (error) {
        logger.error('Failed to get license', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to fetch license' });
    }
});

// =====================================================
// CREATE LICENSE
// =====================================================

/**
 * POST /api/licenses
 * Create a new license key (admin pre-generates for customers)
 */
router.post('/', authenticate, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const {
            licenseType,
            licenseeName, licenseeEmail, licenseeMobile, licenseeCompany,
            maxCompanies, maxUsers, maxVouchersPerMonth, smsCredits,
            expiryDate, features, notes
        } = req.body;

        if (!licenseType || !licenseeName || !licenseeEmail) {
            return res.status(400).json({
                success: false,
                error: 'License type, licensee name, and email are required'
            });
        }

        const validTypes = ['trial', 'basic', 'premium', 'enterprise'];
        if (!validTypes.includes(licenseType)) {
            return res.status(400).json({ success: false, error: `Invalid license type. Must be one of: ${validTypes.join(', ')}` });
        }

        const supabase = getSupabaseClient();

        // Plan defaults
        const planDefaults = {
            trial:      { maxCompanies: 1,  maxUsers: 3,   maxVouchers: 50,   sms: 100,   daysValid: 30 },
            basic:      { maxCompanies: 3,  maxUsers: 10,  maxVouchers: 500,  sms: 1000,  daysValid: 365 },
            premium:    { maxCompanies: 10, maxUsers: 50,  maxVouchers: 2000, sms: 5000,  daysValid: 365 },
            enterprise: { maxCompanies: 99, maxUsers: 999, maxVouchers: 99999, sms: 99999, daysValid: 365 }
        };
        const defaults = planDefaults[licenseType];

        const expiry = expiryDate
            ? new Date(expiryDate)
            : new Date(Date.now() + defaults.daysValid * 24 * 60 * 60 * 1000);

        const licenseKey = LicenseGenerator.generateKey(licenseeEmail, licenseType, expiry.toISOString());

        const { data: license, error } = await supabase
            .from('licenses')
            .insert({
                license_key: licenseKey,
                license_type: licenseType,
                licensee_name: licenseeName,
                licensee_email: licenseeEmail.toLowerCase(),
                licensee_mobile: licenseeMobile || '',
                licensee_company: licenseeCompany || '',
                status: 'pending',
                max_companies: maxCompanies || defaults.maxCompanies,
                max_users: maxUsers || defaults.maxUsers,
                max_vouchers_per_month: maxVouchersPerMonth || defaults.maxVouchers,
                sms_credits: smsCredits || defaults.sms,
                issued_date: new Date().toISOString(),
                expiry_date: expiry.toISOString(),
                features: features || {
                    print: true, reports: true, api_access: licenseType === 'enterprise',
                    custom_domain: licenseType === 'enterprise', white_label: true,
                    multi_company: licenseType !== 'trial', advanced_analytics: ['premium', 'enterprise'].includes(licenseType)
                },
                notes: notes || '',
                created_by: req.user.id
            })
            .select().single();

        if (error) throw error;

        logger.info('License created', {
            licenseKey, licenseType, licenseeEmail,
            createdBy: req.user.id
        });

        res.status(201).json({ success: true, license });

    } catch (error) {
        logger.error('Failed to create license', { error: error.message });
        res.status(500).json({ success: false, error: error.message || 'Failed to create license' });
    }
});

// =====================================================
// UPDATE LICENSE
// =====================================================

/**
 * PUT /api/licenses/:id
 * Update license details
 */
router.put('/:id', authenticate, authorize('super_admin', 'admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();

        const {
            status, licenseType,
            maxCompanies, maxUsers, maxVouchersPerMonth, smsCredits,
            expiryDate, features, notes
        } = req.body;

        // Build update object (only include provided fields)
        const updateData = { updated_at: new Date().toISOString(), updated_by: req.user.id };
        if (status !== undefined) updateData.status = status;
        if (licenseType !== undefined) updateData.license_type = licenseType;
        if (maxCompanies !== undefined) updateData.max_companies = maxCompanies;
        if (maxUsers !== undefined) updateData.max_users = maxUsers;
        if (maxVouchersPerMonth !== undefined) updateData.max_vouchers_per_month = maxVouchersPerMonth;
        if (smsCredits !== undefined) updateData.sms_credits = smsCredits;
        if (expiryDate !== undefined) updateData.expiry_date = expiryDate;
        if (features !== undefined) updateData.features = features;
        if (notes !== undefined) updateData.notes = notes;

        // If activating, set activation_date
        if (status === 'active') {
            const { data: existing } = await supabase
                .from('licenses').select('activation_date').eq('id', req.params.id).single();
            if (existing && !existing.activation_date) {
                updateData.activation_date = new Date().toISOString();
            }
        }

        const { data: license, error } = await supabase
            .from('licenses')
            .update(updateData)
            .eq('id', req.params.id)
            .select().single();

        if (error) throw error;
        if (!license) return res.status(404).json({ success: false, error: 'License not found' });

        logger.info('License updated', { licenseId: req.params.id, changes: Object.keys(updateData), updatedBy: req.user.id });

        res.json({ success: true, license });

    } catch (error) {
        logger.error('Failed to update license', { error: error.message });
        res.status(500).json({ success: false, error: error.message || 'Failed to update license' });
    }
});

// =====================================================
// DELETE LICENSE
// =====================================================

/**
 * DELETE /api/licenses/:id
 * Soft-delete (revoke) or hard-delete a license
 */
router.delete('/:id', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const hardDelete = req.query.hard === 'true';

        if (hardDelete) {
            const { error } = await supabase.from('licenses').delete().eq('id', req.params.id);
            if (error) throw error;
            logger.warn('License hard-deleted', { licenseId: req.params.id, deletedBy: req.user.id });
        } else {
            const { error } = await supabase
                .from('licenses')
                .update({ status: 'revoked', updated_at: new Date().toISOString(), updated_by: req.user.id })
                .eq('id', req.params.id);
            if (error) throw error;
            logger.info('License revoked', { licenseId: req.params.id, revokedBy: req.user.id });
        }

        res.json({ success: true, message: hardDelete ? 'License permanently deleted' : 'License revoked' });

    } catch (error) {
        logger.error('Failed to delete license', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to delete license' });
    }
});

// =====================================================
// VALIDATE LICENSE KEY (Public - no auth)
// =====================================================

/**
 * POST /api/licenses/validate
 * Public endpoint to validate a license key
 */
router.post('/validate', async (req, res) => {
    try {
        const { licenseKey } = req.body;
        if (!licenseKey) {
            return res.status(400).json({ success: false, error: 'License key is required' });
        }

        if (!LicenseGenerator.validateFormat(licenseKey.toUpperCase())) {
            return res.json({ success: true, valid: false, message: 'Invalid license key format' });
        }

        const supabase = getSupabaseClient();
        const { data: license } = await supabase
            .from('licenses')
            .select('license_key, license_type, status, expiry_date')
            .eq('license_key', licenseKey.toUpperCase())
            .single();

        if (!license) {
            return res.json({ success: true, valid: false, message: 'License key not found' });
        }

        const isExpired = license.expiry_date && new Date(license.expiry_date) < new Date();

        res.json({
            success: true,
            valid: !isExpired && license.status === 'active',
            license: {
                type: license.license_type,
                status: isExpired ? 'expired' : license.status,
                expiresAt: license.expiry_date
            }
        });

    } catch (error) {
        logger.error('License validation failed', { error: error.message });
        res.status(500).json({ success: false, error: 'Validation failed' });
    }
});

module.exports = router;
