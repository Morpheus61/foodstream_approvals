/**
 * FoodStream Ltd. - Signature Verification Routes
 * API endpoints for voucher digital signature verification
 * 
 * @module routes/signatures
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getSupabaseClient } = require('../config/database');
const {
  verifyVoucher,
  verifyAndLog,
  getVerificationHistory,
  batchVerifyVouchers,
  rotateOrgSigningSecret
} = require('../services/signatureService');
const logger = require('../utils/logger');

/**
 * @route   POST /api/signatures/verify/:voucherId
 * @desc    Verify digital signature of a voucher
 * @access  Protected (Authenticated users)
 */
router.post('/verify/:voucherId', authenticate, async (req, res) => {
  try {
    const { voucherId } = req.params;
    const userId = req.user.id;
    
    // Fetch voucher data
    const supabase = getSupabaseClient();
    const { data: voucher, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('id', voucherId)
      .single();
    
    if (error || !voucher) {
      return res.status(404).json({
        success: false,
        error: 'Voucher not found'
      });
    }
    
    // Check user has access to this org
    if (voucher.org_id !== req.user.org_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Verify signature and log attempt
    const result = await verifyAndLog(
      voucherId,
      voucher,
      voucher.digital_signature,
      voucher.org_id,
      userId
    );
    
    res.json({
      success: true,
      voucher_number: voucher.voucher_number,
      verification: {
        valid: result.valid,
        signature: result.actual_signature,
        verified_at: result.verified_at,
        algorithm: result.algorithm,
        match: result.match,
        signature_age_seconds: Math.floor(
          (new Date() - new Date(voucher.signature_timestamp)) / 1000
        )
      },
      message: result.valid 
        ? 'Signature valid - voucher data intact' 
        : '⚠️ SIGNATURE INVALID - Possible tampering detected'
    });
    
  } catch (error) {
    logger.error('Signature verification failed', {
      error: error.message,
      voucher_id: req.params.voucherId,
      user_id: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Signature verification failed',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/signatures/history/:voucherId
 * @desc    Get verification history for a voucher
 * @access  Protected
 */
router.get('/history/:voucherId', authenticate, async (req, res) => {
  try {
    const { voucherId } = req.params;
    const supabase = getSupabaseClient();
    
    // Check voucher exists and user has access
    const { data: voucher } = await supabase
      .from('vouchers')
      .select('org_id, voucher_number')
      .eq('id', voucherId)
      .single();
    
    if (!voucher || voucher.org_id !== req.user.org_id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    const history = await getVerificationHistory(voucherId);
    
    res.json({
      success: true,
      voucher_number: voucher.voucher_number,
      verification_count: history.length,
      history
    });
    
  } catch (error) {
    logger.error('Failed to fetch verification history', {
      error: error.message,
      voucher_id: req.params.voucherId
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch verification history'
    });
  }
});

/**
 * @route   POST /api/signatures/batch-verify
 * @desc    Batch verify multiple vouchers
 * @access  Protected (Admin only)
 */
router.post('/batch-verify', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { voucher_ids } = req.body;
    const supabase = getSupabaseClient();
    
    if (!Array.isArray(voucher_ids) || voucher_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'voucher_ids array required'
      });
    }
    
    // Fetch all vouchers
    const { data: vouchers, error } = await supabase
      .from('vouchers')
      .select('*')
      .in('id', voucher_ids)
      .eq('org_id', req.user.org_id);
    
    if (error) throw error;
    
    // Batch verify
    const results = await batchVerifyVouchers(vouchers, req.user.org_id);
    
    const summary = {
      total: results.length,
      valid: results.filter(r => r.valid).length,
      invalid: results.filter(r => !r.valid).length
    };
    
    res.json({
      success: true,
      summary,
      results
    });
    
  } catch (error) {
    logger.error('Batch verification failed', {
      error: error.message,
      user_id: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Batch verification failed'
    });
  }
});

/**
 * @route   POST /api/signatures/rotate-secret
 * @desc    Rotate organization signing secret (Admin only)
 * @access  Protected (Admin)
 */
router.post('/rotate-secret', authenticate, authorize(['admin']), async (req, res) => {
  try {
    
    const orgId = req.user.org_id;
    
    logger.warn('Secret rotation initiated by admin', {
      org_id: orgId,
      admin_user: req.user.id
    });
    
    // Rotate secret and re-sign all vouchers
    const result = await rotateOrgSigningSecret(orgId);
    
    res.json({
      success: true,
      message: 'Signing secret rotated successfully',
      ...result
    });
    
  } catch (error) {
    logger.error('Secret rotation failed', {
      error: error.message,
      org_id: req.user?.org_id,
      user_id: req.user?.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Secret rotation failed',
      details: error.message
    });
  }
});

/**
 * @route   GET /api/signatures/status/:voucherId
 * @desc    Quick signature status check (no logging)
 * @access  Public (for QR code verification)
 */
router.get('/status/:voucherId', async (req, res) => {
  try {
    const { voucherId } = req.params;
    const supabase = getSupabaseClient();
    
    // Fetch voucher
    const { data: voucher, error } = await supabase
      .from('vouchers')
      .select(`
        id,
        voucher_number,
        digital_signature,
        signature_timestamp,
        amount,
        status,
        company:companies(name, logo_url),
        org:licensed_orgs(name)
      `)
      .eq('id', voucherId)
      .single();
    
    if (error || !voucher) {
      return res.status(404).json({
        success: false,
        error: 'Voucher not found'
      });
    }
    
    // Quick verification (no logging for public endpoint)
    const result = await verifyVoucher(
      voucher,
      voucher.digital_signature,
      voucher.org_id
    );
    
    res.json({
      success: true,
      voucher_number: voucher.voucher_number,
      company: voucher.company?.name,
      organization: voucher.org?.name,
      amount: voucher.amount,
      status: voucher.status,
      signature: {
        value: voucher.digital_signature.substring(0, 16) + '...',
        timestamp: voucher.signature_timestamp,
        valid: result.valid,
        algorithm: 'HMAC-SHA256'
      },
      verified_at: result.verified_at
    });
    
  } catch (error) {
    logger.error('Status check failed', {
      error: error.message,
      voucher_id: req.params.voucherId
    });
    
    res.status(500).json({
      success: false,
      error: 'Status check failed'
    });
  }
});

/**
 * @route   GET /api/signatures/verification-stats
 * @desc    Get organization verification statistics
 * @access  Protected (Admin)
 */
router.get('/verification-stats', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const supabase = getSupabaseClient();
    
    // Get verification stats for org vouchers
    const { data: orgVouchers } = await supabase
      .from('vouchers')
      .select('id')
      .eq('org_id', orgId);
    
    const voucherIds = orgVouchers?.map(v => v.id) || [];
    
    const { data: verifications } = await supabase
      .from('signature_verifications')
      .select('verification_result, verified_at')
      .in('voucher_id', voucherIds);
    
    const stats = {
      total_verifications: verifications?.length || 0,
      valid_count: verifications?.filter(v => v.verification_result === 'VALID').length || 0,
      invalid_count: verifications?.filter(v => v.verification_result === 'INVALID').length || 0,
      last_24h: verifications?.filter(v => 
        new Date(v.verified_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
      ).length || 0
    };
    
    res.json({
      success: true,
      organization_id: orgId,
      stats
    });
    
  } catch (error) {
    logger.error('Failed to fetch verification stats', {
      error: error.message,
      org_id: req.user?.org_id
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;
