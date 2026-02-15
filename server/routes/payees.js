const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { verifyLicense } = require('../middleware/licenseCheck');
const { getSupabaseClient } = require('../config/database');
const logger = require('../utils/logger');

// GET /api/payees - List payees for the org (optionally filter by company)
router.get('/', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { company_id, status, search, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('payees')
            .select('*, companies(name)', { count: 'exact' })
            .eq('org_id', req.user.org_id)
            .order('created_at', { ascending: false });

        if (company_id) query = query.eq('company_id', company_id);
        if (status) query = query.eq('status', status);
        if (search) query = query.or(`name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%`);

        const { data, count, error } = await query.range(offset, offset + parseInt(limit) - 1);
        if (error) throw error;

        res.json({ success: true, data: data || [], pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 } });
    } catch (error) {
        logger.error('List payees error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/payees/:id
router.get('/:id', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.from('payees').select('*, companies(name)').eq('id', req.params.id).eq('org_id', req.user.org_id).single();
        if (error || !data) return res.status(404).json({ success: false, error: 'Payee not found' });
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Get payee error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/payees
router.post('/', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { company_id, name, mobile, email, address, city, state, pincode, pan_number, gst_number, bank_name, account_number, ifsc_code, account_holder_name, upi_id, payee_type, notes } = req.body;
        if (!company_id || !name || !mobile) return res.status(400).json({ success: false, error: 'company_id, name, and mobile are required' });

        // Verify company belongs to org
        const { data: company } = await supabase.from('companies').select('id').eq('id', company_id).eq('org_id', req.user.org_id).single();
        if (!company) return res.status(400).json({ success: false, error: 'Invalid company' });

        const { data, error } = await supabase.from('payees').insert({
            org_id: req.user.org_id, company_id, name, mobile: mobile.replace(/[\s\-()]/g, '').substring(0, 20),
            email, address, city, state, pincode, pan_number, gst_number,
            bank_name, account_number, ifsc_code, account_holder_name, upi_id,
            payee_type: payee_type || 'vendor', notes, status: 'active', created_by: req.user.id
        }).select().single();

        if (error) {
            if (error.code === '23505') return res.status(400).json({ success: false, error: 'A payee with this mobile already exists for this company' });
            throw error;
        }
        logger.audit('payee_created', req.user.id, { payeeId: data.id, name });
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Create payee error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/payees/:id
router.put('/:id', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { data: existing } = await supabase.from('payees').select('id').eq('id', req.params.id).eq('org_id', req.user.org_id).single();
        if (!existing) return res.status(404).json({ success: false, error: 'Payee not found' });
        const updates = { ...req.body, updated_at: new Date().toISOString() };
        delete updates.id; delete updates.org_id; delete updates.created_by; delete updates.created_at;
        const { data, error } = await supabase.from('payees').update(updates).eq('id', req.params.id).select().single();
        if (error) throw error;
        logger.audit('payee_updated', req.user.id, { payeeId: req.params.id });
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Update payee error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/payees/:id
router.delete('/:id', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { error } = await supabase.from('payees').delete().eq('id', req.params.id).eq('org_id', req.user.org_id);
        if (error) throw error;
        logger.audit('payee_deleted', req.user.id, { payeeId: req.params.id });
        res.json({ success: true, message: 'Payee deleted' });
    } catch (error) {
        logger.error('Delete payee error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
