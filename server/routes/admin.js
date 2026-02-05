const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getSupabaseClient } = require('../config/database');
const logger = require('../utils/logger');

// =====================================================
// ADMIN DASHBOARD STATS - Real-time from Supabase
// =====================================================

// GET /api/admin/dashboard/stats
router.get('/dashboard/stats', authenticate, authorize('super_admin', 'org_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        
        // Get total users count
        const { count: totalUsers } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        // Get active subscriptions (active licenses)
        const { count: activeSubscriptions } = await supabase
            .from('licenses')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active');

        // Get trial licenses
        const { count: freeTrials } = await supabase
            .from('licenses')
            .select('*', { count: 'exact', head: true })
            .eq('license_type', 'trial')
            .eq('status', 'active');

        // Get expiring trials (next 7 days)
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        
        const { count: expiringTrials } = await supabase
            .from('licenses')
            .select('*', { count: 'exact', head: true })
            .eq('license_type', 'trial')
            .eq('status', 'active')
            .lte('expiry_date', sevenDaysFromNow.toISOString());

        // Get total companies
        const { count: totalCompanies } = await supabase
            .from('companies')
            .select('*', { count: 'exact', head: true });

        // Get total organizations
        const { count: totalOrgs } = await supabase
            .from('licensed_orgs')
            .select('*', { count: 'exact', head: true });

        // Get vouchers this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const { count: vouchersThisMonth } = await supabase
            .from('vouchers')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfMonth.toISOString());

        // Calculate monthly revenue (based on active paid licenses)
        const { data: paidLicenses } = await supabase
            .from('licenses')
            .select('license_type')
            .eq('status', 'active')
            .neq('license_type', 'trial');

        // Pricing estimates (HKD)
        const pricing = {
            basic: 720,
            premium: 1920,
            enterprise: 4800
        };

        let monthlyRevenue = 0;
        if (paidLicenses) {
            paidLicenses.forEach(license => {
                monthlyRevenue += pricing[license.license_type] || 0;
            });
        }

        res.json({
            success: true,
            stats: {
                totalUsers: totalUsers || 0,
                activeSubscriptions: activeSubscriptions || 0,
                freeTrials: freeTrials || 0,
                expiringTrials: expiringTrials || 0,
                totalCompanies: totalCompanies || 0,
                totalOrgs: totalOrgs || 0,
                vouchersThisMonth: vouchersThisMonth || 0,
                monthlyRevenue: monthlyRevenue
            }
        });

    } catch (error) {
        logger.error('Dashboard stats error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// RECENT SUBSCRIPTIONS - Real-time
// =====================================================

// GET /api/admin/subscriptions/recent
router.get('/subscriptions/recent', authenticate, authorize('super_admin', 'org_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const limit = parseInt(req.query.limit) || 10;

        const { data: subscriptions, error } = await supabase
            .from('licenses')
            .select(`
                *,
                licensed_orgs (
                    org_name,
                    org_slug,
                    currency
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        // Format for frontend
        const formatted = (subscriptions || []).map(sub => ({
            id: sub.id,
            company: sub.licensed_orgs?.org_name || sub.licensee_company || sub.licensee_name,
            plan: sub.license_type,
            status: sub.status,
            email: sub.licensee_email,
            createdAt: sub.created_at,
            expiryDate: sub.expiry_date
        }));

        res.json({ success: true, subscriptions: formatted });

    } catch (error) {
        logger.error('Recent subscriptions error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// RECENT ACTIVITY - Real-time audit log
// =====================================================

// GET /api/admin/activity/recent
router.get('/activity/recent', authenticate, authorize('super_admin', 'org_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const limit = parseInt(req.query.limit) || 10;

        // Get recent voucher audit logs
        const { data: voucherActivity } = await supabase
            .from('voucher_audit_log')
            .select(`
                id,
                action,
                performed_by_name,
                created_at,
                vouchers (
                    voucher_number,
                    amount
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        // Get recent user logins
        const { data: loginActivity } = await supabase
            .from('users')
            .select('id, username, full_name, last_login, role')
            .not('last_login', 'is', null)
            .order('last_login', { ascending: false })
            .limit(5);

        // Get recent license verifications
        const { data: licenseActivity } = await supabase
            .from('license_verifications')
            .select('id, status, verification_time, ip_address, country')
            .order('verification_time', { ascending: false })
            .limit(5);

        // Combine and format activities
        const activities = [];

        // Add voucher activities
        if (voucherActivity) {
            voucherActivity.forEach(act => {
                activities.push({
                    id: act.id,
                    type: 'voucher',
                    icon: act.action === 'approved' ? 'check-circle' : act.action === 'created' ? 'plus-circle' : 'file-text',
                    text: `Voucher ${act.vouchers?.voucher_number || ''} ${act.action} by ${act.performed_by_name || 'System'}`,
                    time: act.created_at,
                    color: act.action === 'approved' ? 'text-green-600' : act.action === 'rejected' ? 'text-red-600' : 'text-blue-600'
                });
            });
        }

        // Add login activities
        if (loginActivity) {
            loginActivity.forEach(user => {
                activities.push({
                    id: `login-${user.id}`,
                    type: 'login',
                    icon: 'user',
                    text: `${user.full_name} (${user.role}) logged in`,
                    time: user.last_login,
                    color: 'text-purple-600'
                });
            });
        }

        // Add license activities
        if (licenseActivity) {
            licenseActivity.forEach(lic => {
                activities.push({
                    id: lic.id,
                    type: 'license',
                    icon: 'key',
                    text: `License verification: ${lic.status} from ${lic.country || lic.ip_address || 'Unknown'}`,
                    time: lic.verification_time,
                    color: lic.status === 'valid' ? 'text-green-600' : 'text-orange-600'
                });
            });
        }

        // Sort by time and limit
        activities.sort((a, b) => new Date(b.time) - new Date(a.time));
        const limitedActivities = activities.slice(0, limit);

        res.json({ success: true, activities: limitedActivities });

    } catch (error) {
        logger.error('Recent activity error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// ALL USERS - Real-time
// =====================================================

// GET /api/admin/users
router.get('/users', authenticate, authorize('super_admin', 'org_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { page = 1, limit = 20, role, status, search } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('users')
            .select(`
                *,
                licensed_orgs (
                    org_name,
                    org_slug
                ),
                companies (
                    name
                )
            `, { count: 'exact' });

        if (role) query = query.eq('role', role);
        if (status) query = query.eq('status', status);
        if (search) {
            query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const { data: users, count, error } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        // Remove password hashes from response
        const sanitizedUsers = (users || []).map(u => {
            const { password_hash, ...user } = u;
            return user;
        });

        res.json({
            success: true,
            users: sanitizedUsers,
            pagination: {
                total: count || 0,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil((count || 0) / limit)
            }
        });

    } catch (error) {
        logger.error('Get users error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// ALL LICENSES - Real-time
// =====================================================

// GET /api/admin/licenses
router.get('/licenses', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { page = 1, limit = 20, type, status } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('licenses')
            .select(`
                *,
                licensed_orgs (
                    org_name,
                    org_slug,
                    status
                )
            `, { count: 'exact' });

        if (type) query = query.eq('license_type', type);
        if (status) query = query.eq('status', status);

        const { data: licenses, count, error } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json({
            success: true,
            licenses: licenses || [],
            pagination: {
                total: count || 0,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil((count || 0) / limit)
            }
        });

    } catch (error) {
        logger.error('Get licenses error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// ALL COMPANIES - Real-time
// =====================================================

// GET /api/admin/companies
router.get('/companies', authenticate, authorize('super_admin', 'org_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('companies')
            .select(`
                *,
                licensed_orgs (
                    org_name
                )
            `, { count: 'exact' });

        if (status) query = query.eq('status', status);

        const { data: companies, count, error } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json({
            success: true,
            companies: companies || [],
            pagination: {
                total: count || 0,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil((count || 0) / limit)
            }
        });

    } catch (error) {
        logger.error('Get companies error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// ALL ORGANIZATIONS - Real-time
// =====================================================

// GET /api/admin/organizations
router.get('/organizations', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('licensed_orgs')
            .select(`
                *,
                licenses (
                    license_key,
                    license_type,
                    status,
                    expiry_date
                )
            `, { count: 'exact' });

        if (status) query = query.eq('status', status);

        const { data: organizations, count, error } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        res.json({
            success: true,
            organizations: organizations || [],
            pagination: {
                total: count || 0,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil((count || 0) / limit)
            }
        });

    } catch (error) {
        logger.error('Get organizations error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// =====================================================
// VOUCHER STATS - Real-time
// =====================================================

// GET /api/admin/vouchers/stats
router.get('/vouchers/stats', authenticate, authorize('super_admin', 'org_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();

        // Get all vouchers to calculate stats
        const { data: allVouchers } = await supabase
            .from('vouchers')
            .select('status, payment_mode, amount, created_at');

        // Calculate counts by status
        const byStatus = {};
        const byPaymentMode = {};
        
        if (allVouchers) {
            allVouchers.forEach(v => {
                byStatus[v.status] = (byStatus[v.status] || 0) + 1;
                byPaymentMode[v.payment_mode] = (byPaymentMode[v.payment_mode] || 0) + 1;
            });
        }

        // Get total amount this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const totalAmountThisMonth = (allVouchers || [])
            .filter(v => new Date(v.created_at) >= startOfMonth)
            .reduce((sum, v) => sum + parseFloat(v.amount || 0), 0);

        res.json({
            success: true,
            stats: {
                byStatus,
                totalAmountThisMonth,
                byPaymentMode
            }
        });

    } catch (error) {
        logger.error('Voucher stats error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
