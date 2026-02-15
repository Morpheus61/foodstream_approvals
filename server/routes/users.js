const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { verifyLicense } = require('../middleware/licenseCheck');
const { getSupabaseClient } = require('../config/database');
const encryptionUtil = require('../utils/encryption');
const logger = require('../utils/logger');

// GET /api/users - List users in the org
router.get('/', authenticate, verifyLicense, authorize('super_admin', 'org_admin', 'company_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { role, status, search, page = 1, limit = 50 } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('users')
            .select('id, username, full_name, email, mobile, role, status, company_id, last_login, created_at, companies!fk_users_company(name)', { count: 'exact' })
            .eq('org_id', req.user.org_id)
            .order('created_at', { ascending: false });

        if (role) query = query.eq('role', role);
        if (status) query = query.eq('status', status);
        if (search) query = query.or(`full_name.ilike.%${search}%,username.ilike.%${search}%,email.ilike.%${search}%`);

        const { data, count, error } = await query.range(offset, offset + parseInt(limit) - 1);
        if (error) throw error;

        const maxUsers = req.license?.max_users || 3;
        res.json({
            success: true,
            data: data || [],
            pagination: { page: parseInt(page), limit: parseInt(limit), total: count || 0 },
            limits: { max: maxUsers, used: count || 0 }
        });
    } catch (error) {
        logger.error('List users error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/users - Create a new user in the org
router.post('/', authenticate, verifyLicense, authorize('super_admin', 'org_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();

        // Check user limit
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('org_id', req.user.org_id);
        const maxUsers = req.license?.max_users || 3;
        if (count >= maxUsers) {
            return res.status(429).json({ success: false, error: `User limit reached (${maxUsers}). Upgrade your plan.`, code: 'LIMIT_USERS' });
        }

        const { username, full_name, email, mobile, password, role, company_id } = req.body;
        if (!username || !full_name || !mobile || !password) {
            return res.status(400).json({ success: false, error: 'username, full_name, mobile, and password are required' });
        }

        // Validate role - org_admin can't create super_admins
        const allowedRoles = ['org_admin', 'company_admin', 'approver', 'accounts', 'viewer'];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ success: false, error: `Invalid role. Allowed: ${allowedRoles.join(', ')}` });
        }

        // If company_id given, verify it belongs to org
        if (company_id) {
            const { data: company } = await supabase.from('companies').select('id').eq('id', company_id).eq('org_id', req.user.org_id).single();
            if (!company) return res.status(400).json({ success: false, error: 'Invalid company' });
        }

        const passwordHash = await encryptionUtil.hashPassword(password);
        const { data, error } = await supabase.from('users').insert({
            org_id: req.user.org_id, username, full_name, email: email?.toLowerCase(),
            mobile: mobile.replace(/[\s\-()]/g, '').substring(0, 20),
            password_hash: passwordHash, role, company_id, status: 'active', created_by: req.user.id
        }).select('id, username, full_name, email, mobile, role, status, company_id, created_at').single();

        if (error) {
            if (error.code === '23505') return res.status(400).json({ success: false, error: 'Username already exists' });
            throw error;
        }
        logger.audit('user_created', req.user.id, { newUserId: data.id, username, role });
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Create user error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticate, verifyLicense, authorize('super_admin', 'org_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { id } = req.params;
        const { data: existing } = await supabase.from('users').select('id, role').eq('id', id).eq('org_id', req.user.org_id).single();
        if (!existing) return res.status(404).json({ success: false, error: 'User not found' });

        const updates = {};
        if (req.body.full_name) updates.full_name = req.body.full_name;
        if (req.body.email) updates.email = req.body.email.toLowerCase();
        if (req.body.mobile) updates.mobile = req.body.mobile;
        if (req.body.role) updates.role = req.body.role;
        if (req.body.status) updates.status = req.body.status;
        if (req.body.company_id) updates.company_id = req.body.company_id;
        if (req.body.password) updates.password_hash = await encryptionUtil.hashPassword(req.body.password);
        updates.updated_at = new Date().toISOString();

        const { data, error } = await supabase.from('users')
            .update(updates).eq('id', id)
            .select('id, username, full_name, email, mobile, role, status, company_id, created_at').single();
        if (error) throw error;
        logger.audit('user_updated', req.user.id, { targetUserId: id });
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Update user error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/users/:id - Deactivate user
router.delete('/:id', authenticate, verifyLicense, authorize('super_admin', 'org_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { id } = req.params;
        if (id === req.user.id) return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
        const { error } = await supabase.from('users').update({ status: 'inactive' }).eq('id', id).eq('org_id', req.user.org_id);
        if (error) throw error;
        logger.audit('user_deactivated', req.user.id, { targetUserId: id });
        res.json({ success: true, message: 'User deactivated' });
    } catch (error) {
        logger.error('Delete user error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
