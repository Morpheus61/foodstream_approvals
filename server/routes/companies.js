const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { verifyLicense } = require('../middleware/licenseCheck');
const { getSupabaseClient } = require('../config/database');
const logger = require('../utils/logger');

// GET /api/companies - List companies for the authenticated user's org
router.get('/', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { status, search, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('companies')
            .select('*', { count: 'exact' })
            .eq('org_id', req.user.org_id)
            .order('created_at', { ascending: false });

        if (status) query = query.eq('status', status);
        if (search) query = query.or(`name.ilike.%${search}%,legal_name.ilike.%${search}%`);

        const { data, count, error } = await query.range(offset, offset + parseInt(limit) - 1);
        if (error) throw error;

        const maxCompanies = req.license?.max_companies || 1;

        res.json({
            success: true,
            data: data || [],
            pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 },
            limits: { max: maxCompanies, used: count || 0 }
        });
    } catch (error) {
        logger.error('List companies error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/companies/:id
router.get('/:id', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .eq('id', req.params.id)
            .eq('org_id', req.user.org_id)
            .single();
        if (error || !data) return res.status(404).json({ success: false, error: 'Company not found' });
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Get company error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/companies
router.post('/', authenticate, verifyLicense, authorize('super_admin', 'org_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { count } = await supabase.from('companies').select('*', { count: 'exact', head: true }).eq('org_id', req.user.org_id);
        const maxCompanies = req.license?.max_companies || 1;
        if (count >= maxCompanies) {
            return res.status(429).json({ success: false, error: `Company limit reached (${maxCompanies}). Upgrade your plan.`, code: 'LIMIT_COMPANIES' });
        }
        const { name, legal_name, gst_number, pan_number, tan_number, address_line1, address_line2, city, state, pincode, country, phone, email, website, bank_name, bank_account_number, bank_ifsc, bank_branch, voucher_prefix, fiscal_year_start } = req.body;
        if (!name) return res.status(400).json({ success: false, error: 'Company name is required' });
        const { data, error } = await supabase.from('companies').insert({
            org_id: req.user.org_id, name, legal_name, gst_number, pan_number, tan_number,
            address_line1, address_line2, city, state, pincode, country: country || 'HK',
            phone, email, website, bank_name, bank_account_number, bank_ifsc, bank_branch,
            voucher_prefix: voucher_prefix || 'VCH', fiscal_year_start: fiscal_year_start || 4,
            status: 'active', created_by: req.user.id
        }).select().single();
        if (error) throw error;
        logger.audit('company_created', req.user.id, { companyId: data.id, name });
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Create company error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/companies/:id
router.put('/:id', authenticate, verifyLicense, authorize('super_admin', 'org_admin', 'company_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { id } = req.params;
        const { data: existing } = await supabase.from('companies').select('id').eq('id', id).eq('org_id', req.user.org_id).single();
        if (!existing) return res.status(404).json({ success: false, error: 'Company not found' });
        const updates = { ...req.body, updated_at: new Date().toISOString() };
        delete updates.id; delete updates.org_id; delete updates.created_by; delete updates.created_at;
        const { data, error } = await supabase.from('companies').update(updates).eq('id', id).select().single();
        if (error) throw error;
        logger.audit('company_updated', req.user.id, { companyId: id });
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Update company error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/companies/:id
router.delete('/:id', authenticate, verifyLicense, authorize('super_admin', 'org_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { error } = await supabase.from('companies').delete().eq('id', req.params.id).eq('org_id', req.user.org_id);
        if (error) throw error;
        logger.audit('company_deleted', req.user.id, { companyId: req.params.id });
        res.json({ success: true, message: 'Company deleted' });
    } catch (error) {
        logger.error('Delete company error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
