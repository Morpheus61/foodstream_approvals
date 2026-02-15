const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { verifyLicense } = require('../middleware/licenseCheck');
const { getSupabaseClient } = require('../config/database');
const logger = require('../utils/logger');

// GET /api/reports/dashboard-stats - Dashboard summary
router.get('/dashboard-stats', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const orgId = req.user.org_id;
        const today = new Date().toISOString().split('T')[0];
        const monthStart = today.substring(0, 7) + '-01';

        // All queries in parallel
        const [pending, approvedToday, totalPending, monthlyVouchers, companiesCount, usersCount, payeesCount, recentVouchers] = await Promise.all([
            // Pending vouchers count
            supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'pending_approval'),
            // Approved today
            supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'approved').gte('approved_at', today),
            // Total pending amount
            supabase.from('vouchers').select('amount').eq('org_id', orgId).eq('status', 'pending_approval'),
            // Vouchers this month
            supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('org_id', orgId).gte('created_at', monthStart),
            // Companies count
            supabase.from('companies').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active'),
            // Users count
            supabase.from('users').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active'),
            // Payees count
            supabase.from('payees').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active'),
            // Recent vouchers
            supabase.from('vouchers').select('id, voucher_number, amount, status, payment_mode, created_at, payee_name, companies(name)').eq('org_id', orgId).order('created_at', { ascending: false }).limit(10)
        ]);

        const totalPendingAmount = (totalPending.data || []).reduce((sum, v) => sum + parseFloat(v.amount || 0), 0);

        // My pending approvals (if approver role)
        let myPendingApprovals = 0;
        if (['org_admin', 'company_admin', 'approver'].includes(req.user.role)) {
            const { count } = await supabase.from('vouchers').select('*', { count: 'exact', head: true })
                .eq('org_id', orgId).eq('status', 'pending_approval');
            myPendingApprovals = count || 0;
        }

        res.json({
            success: true,
            data: {
                pendingVouchers: pending.count || 0,
                approvedToday: approvedToday.count || 0,
                totalPendingAmount,
                monthlyVouchers: monthlyVouchers.count || 0,
                myPendingApprovals,
                companiesCount: companiesCount.count || 0,
                usersCount: usersCount.count || 0,
                payeesCount: payeesCount.count || 0,
                recentVouchers: recentVouchers.data || [],
                limits: {
                    maxCompanies: req.license?.max_companies || 1,
                    maxUsers: req.license?.max_users || 3,
                    maxVouchersPerMonth: req.license?.max_vouchers_per_month || 50,
                    smsCredits: req.license?.sms_credits || 100,
                    planType: req.license?.license_type || 'trial',
                    expiryDate: req.license?.expiry_date
                }
            }
        });
    } catch (error) {
        logger.error('Dashboard stats error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/reports/voucher-summary - Voucher breakdown by status
router.get('/voucher-summary', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const orgId = req.user.org_id;
        const { from_date, to_date, company_id } = req.query;

        let query = supabase.from('vouchers').select('status, amount').eq('org_id', orgId);
        if (from_date) query = query.gte('created_at', from_date);
        if (to_date) query = query.lte('created_at', to_date);
        if (company_id) query = query.eq('company_id', company_id);

        const { data, error } = await query;
        if (error) throw error;

        const summary = {};
        (data || []).forEach(v => {
            if (!summary[v.status]) summary[v.status] = { count: 0, amount: 0 };
            summary[v.status].count++;
            summary[v.status].amount += parseFloat(v.amount);
        });

        res.json({ success: true, data: summary });
    } catch (error) {
        logger.error('Voucher summary error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/reports/monthly-trend - Monthly voucher trend
router.get('/monthly-trend', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const orgId = req.user.org_id;
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const { data, error } = await supabase.from('vouchers')
            .select('amount, status, created_at')
            .eq('org_id', orgId)
            .gte('created_at', sixMonthsAgo.toISOString());
        if (error) throw error;

        const months = {};
        (data || []).forEach(v => {
            const month = v.created_at.substring(0, 7);
            if (!months[month]) months[month] = { count: 0, amount: 0, approved: 0, rejected: 0 };
            months[month].count++;
            months[month].amount += parseFloat(v.amount);
            if (v.status === 'approved' || v.status === 'completed') months[month].approved++;
            if (v.status === 'rejected') months[month].rejected++;
        });

        res.json({ success: true, data: months });
    } catch (error) {
        logger.error('Monthly trend error', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
