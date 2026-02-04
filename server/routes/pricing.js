const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getSupabaseClient } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Pricing Management API
 * Allows super admins to configure pricing dynamically
 */

// =====================================================
// PUBLIC ENDPOINTS (No Auth Required)
// =====================================================

/**
 * GET /api/pricing/plans
 * Get all active pricing plans (public)
 */
router.get('/plans', async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        
        const { data: plans, error } = await supabase
            .from('current_pricing')
            .select('*')
            .order('display_order');
        
        if (error) throw error;
        
        res.json({
            success: true,
            plans: plans,
            currency: plans[0]?.currency || 'HKD'
        });
        
    } catch (error) {
        logger.error('Failed to fetch pricing plans', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pricing plans'
        });
    }
});

/**
 * GET /api/pricing/plans/:planCode
 * Get specific plan details (public)
 */
router.get('/plans/:planCode', async (req, res) => {
    try {
        const { planCode } = req.params;
        const supabase = getSupabaseClient();
        
        const { data: plan, error } = await supabase
            .from('current_pricing')
            .select('*')
            .eq('plan_code', planCode)
            .single();
        
        if (error || !plan) {
            return res.status(404).json({
                success: false,
                error: 'Plan not found'
            });
        }
        
        res.json({
            success: true,
            plan: plan
        });
        
    } catch (error) {
        logger.error('Failed to fetch plan', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch plan details'
        });
    }
});

/**
 * GET /api/pricing/addons
 * Get all available add-ons (public)
 */
router.get('/addons', async (req, res) => {
    try {
        const { category, planCode } = req.query;
        const supabase = getSupabaseClient();
        
        let query = supabase
            .from('pricing_addons')
            .select('*')
            .eq('status', 'active')
            .eq('is_visible', true);
        
        if (category) {
            query = query.eq('addon_category', category);
        }
        
        const { data: addons, error } = await query.order('display_order');
        
        if (error) throw error;
        
        // Filter by plan if specified
        let filteredAddons = addons;
        if (planCode) {
            filteredAddons = addons.filter(addon => 
                !addon.available_for_plans || 
                addon.available_for_plans.includes(planCode)
            );
        }
        
        res.json({
            success: true,
            addons: filteredAddons
        });
        
    } catch (error) {
        logger.error('Failed to fetch add-ons', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch add-ons'
        });
    }
});

/**
 * GET /api/pricing/compare
 * Get plan comparison data (public)
 */
router.get('/compare', async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        
        const { data: plans, error } = await supabase
            .from('current_pricing')
            .select('*')
            .order('display_order');
        
        if (error) throw error;
        
        // Format for comparison table
        const comparison = {
            plans: plans.map(p => ({
                code: p.plan_code,
                name: p.plan_name,
                price: p.price_monthly,
                currency: p.currency
            })),
            features: extractFeatureComparison(plans)
        };
        
        res.json({
            success: true,
            comparison: comparison
        });
        
    } catch (error) {
        logger.error('Failed to generate comparison', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to generate comparison'
        });
    }
});

// =====================================================
// ADMIN ENDPOINTS (Super Admin Only)
// =====================================================

/**
 * GET /api/pricing/admin/plans
 * Get all plans including inactive (admin only)
 */
router.get('/admin/plans', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        
        const { data: plans, error } = await supabase
            .from('pricing_plans')
            .select('*')
            .order('display_order');
        
        if (error) throw error;
        
        res.json({
            success: true,
            plans: plans
        });
        
    } catch (error) {
        logger.error('Admin fetch plans failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/pricing/admin/plans
 * Create new pricing plan (admin only)
 */
router.post('/admin/plans', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const planData = req.body;
        
        // Add creator info
        planData.created_by = req.user.id;
        
        const { data: plan, error } = await supabase
            .from('pricing_plans')
            .insert(planData)
            .select()
            .single();
        
        if (error) throw error;
        
        logger.audit('pricing_plan_created', req.user.id, { 
            planCode: plan.plan_code 
        });
        
        res.json({
            success: true,
            plan: plan,
            message: 'Pricing plan created successfully'
        });
        
    } catch (error) {
        logger.error('Failed to create plan', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/pricing/admin/plans/:id
 * Update pricing plan (admin only)
 */
router.put('/admin/plans/:id', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = getSupabaseClient();
        const updateData = req.body;
        
        // Add updater info
        updateData.updated_by = req.user.id;
        
        const { data: plan, error } = await supabase
            .from('pricing_plans')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        
        logger.audit('pricing_plan_updated', req.user.id, { 
            planId: id,
            changes: Object.keys(updateData)
        });
        
        res.json({
            success: true,
            plan: plan,
            message: 'Pricing plan updated successfully'
        });
        
    } catch (error) {
        logger.error('Failed to update plan', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * DELETE /api/pricing/admin/plans/:id
 * Delete (soft delete) pricing plan (admin only)
 */
router.delete('/admin/plans/:id', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = getSupabaseClient();
        
        // Soft delete by setting status to inactive
        const { data: plan, error } = await supabase
            .from('pricing_plans')
            .update({ 
                status: 'inactive',
                updated_by: req.user.id 
            })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        
        logger.audit('pricing_plan_deleted', req.user.id, { planId: id });
        
        res.json({
            success: true,
            message: 'Pricing plan deactivated successfully'
        });
        
    } catch (error) {
        logger.error('Failed to delete plan', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/pricing/admin/addons
 * Create new add-on (admin only)
 */
router.post('/admin/addons', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const addonData = req.body;
        
        const { data: addon, error } = await supabase
            .from('pricing_addons')
            .insert(addonData)
            .select()
            .single();
        
        if (error) throw error;
        
        logger.audit('pricing_addon_created', req.user.id, { 
            addonCode: addon.addon_code 
        });
        
        res.json({
            success: true,
            addon: addon,
            message: 'Add-on created successfully'
        });
        
    } catch (error) {
        logger.error('Failed to create addon', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/pricing/admin/addons/:id
 * Update add-on (admin only)
 */
router.put('/admin/addons/:id', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = getSupabaseClient();
        
        const { data: addon, error } = await supabase
            .from('pricing_addons')
            .update(req.body)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        
        logger.audit('pricing_addon_updated', req.user.id, { addonId: id });
        
        res.json({
            success: true,
            addon: addon,
            message: 'Add-on updated successfully'
        });
        
    } catch (error) {
        logger.error('Failed to update addon', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/pricing/admin/bulk-update
 * Bulk update pricing (e.g., currency conversion)
 */
router.post('/admin/bulk-update', authenticate, authorize('super_admin'), async (req, res) => {
    try {
        const { operation, multiplier, currency } = req.body;
        const supabase = getSupabaseClient();
        
        if (operation === 'currency_conversion') {
            // Update all plans
            const { data: plans } = await supabase
                .from('pricing_plans')
                .select('*');
            
            for (const plan of plans) {
                await supabase
                    .from('pricing_plans')
                    .update({
                        price_monthly: plan.price_monthly * multiplier,
                        price_annual: plan.price_annual * multiplier,
                        currency: currency,
                        updated_by: req.user.id
                    })
                    .eq('id', plan.id);
            }
            
            // Update all addons
            const { data: addons } = await supabase
                .from('pricing_addons')
                .select('*');
            
            for (const addon of addons) {
                await supabase
                    .from('pricing_addons')
                    .update({
                        price: addon.price * multiplier,
                        currency: currency
                    })
                    .eq('id', addon.id);
            }
            
            logger.audit('pricing_bulk_update', req.user.id, { 
                operation,
                multiplier,
                currency
            });
            
            res.json({
                success: true,
                message: `Updated ${plans.length} plans and ${addons.length} add-ons`
            });
        }
        
    } catch (error) {
        logger.error('Bulk update failed', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function
function extractFeatureComparison(plans) {
    const allFeatures = new Set();
    
    // Collect all unique features
    plans.forEach(plan => {
        Object.keys(plan.features).forEach(feature => {
            allFeatures.add(feature);
        });
    });
    
    // Build comparison matrix
    const comparison = {};
    allFeatures.forEach(feature => {
        comparison[feature] = plans.map(plan => 
            plan.features[feature] || false
        );
    });
    
    return comparison;
}

module.exports = router;
