const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { verifyLicense } = require('../middleware/licenseCheck');
const { getSupabaseClient } = require('../config/database');
const { signVoucher, verifyVoucher } = require('../services/signatureService');
const SMSService = require('../services/smsService');
const logger = require('../utils/logger');

// =====================================================
// HEADS OF ACCOUNT
// =====================================================

/**
 * GET /api/vouchers/heads-of-account - List heads of account for a company
 */
router.get('/heads-of-account', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { company_id } = req.query;
        let query = supabase
            .from('heads_of_account')
            .select('id, code, name, category, status')
            .eq('org_id', req.user.org_id)
            .eq('status', 'active')
            .order('code');
        if (company_id) {
            query = query.or(`company_id.eq.${company_id},company_id.is.null`);
        }
        const { data, error } = await query;
        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        logger.error('Failed to fetch heads of account', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to fetch heads of account' });
    }
});

// =====================================================
// VOUCHER CRUD OPERATIONS
// =====================================================

/**
 * GET /api/vouchers - List all vouchers for the organization
 * Supports filtering by status, company, date range, and pagination
 */
router.get('/', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { 
            status, 
            company_id, 
            from_date, 
            to_date, 
            page = 1, 
            limit = 20,
            search 
        } = req.query;
        
        let query = supabase
            .from('vouchers')
            .select(`
                *,
                company:companies(id, name),
                payee:payees(id, name, mobile),
                head_of_account:heads_of_account(id, code, name),
                created_by_user:users!vouchers_created_by_fkey(id, full_name),
                approved_by_user:users!vouchers_approved_by_fkey(id, full_name)
            `, { count: 'exact' })
            .eq('org_id', req.user.org_id)
            .order('created_at', { ascending: false });
        
        // Apply filters
        if (status) {
            query = query.eq('status', status);
        }
        
        if (company_id) {
            query = query.eq('company_id', company_id);
        }
        
        if (from_date) {
            query = query.gte('created_at', from_date);
        }
        
        if (to_date) {
            query = query.lte('created_at', to_date);
        }
        
        if (search) {
            query = query.or(`voucher_number.ilike.%${search}%,description.ilike.%${search}%`);
        }
        
        // Pagination
        const offset = (page - 1) * limit;
        query = query.range(offset, offset + limit - 1);
        
        const { data: vouchers, count, error } = await query;
        
        if (error) {
            throw error;
        }
        
        res.json({
            success: true,
            data: vouchers,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                total_pages: Math.ceil(count / limit)
            }
        });
        
    } catch (error) {
        logger.error('Failed to fetch vouchers', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to fetch vouchers' });
    }
});

/**
 * GET /api/vouchers/:id - Get a single voucher by ID
 */
router.get('/:id', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { id } = req.params;
        
        const { data: voucher, error } = await supabase
            .from('vouchers')
            .select(`
                *,
                company:companies(id, name, logo_url),
                payee:payees(id, name, mobile, email, bank_account_number, bank_ifsc),
                head_of_account:heads_of_account(id, code, name),
                created_by_user:users!vouchers_created_by_fkey(id, full_name, email),
                approved_by_user:users!vouchers_approved_by_fkey(id, full_name, email)
            `)
            .eq('id', id)
            .eq('org_id', req.user.org_id)
            .single();
        
        if (error || !voucher) {
            return res.status(404).json({ success: false, error: 'Voucher not found' });
        }
        
        // Get audit trail
        const { data: auditLog } = await supabase
            .from('voucher_audit_log')
            .select('*')
            .eq('voucher_id', id)
            .order('created_at', { ascending: true });
        
        res.json({
            success: true,
            data: {
                ...voucher,
                audit_log: auditLog || []
            }
        });
        
    } catch (error) {
        logger.error('Failed to fetch voucher', { error: error.message, id: req.params.id });
        res.status(500).json({ success: false, error: 'Failed to fetch voucher' });
    }
});

/**
 * POST /api/vouchers - Create a new voucher with auto-signing
 */
router.post('/', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const {
            company_id,
            payee_id,
            amount,
            payment_mode,
            head_of_account_id,
            description,
            remarks,
            upi_id,
            bank_account_number,
            cheque_number,
            cheque_date,
            attachments
        } = req.body;
        
        // Validate required fields
        if (!company_id || !payee_id || !amount || !payment_mode || !description) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: company_id, payee_id, amount, payment_mode, description' 
            });
        }
        
        // Validate amount
        if (amount <= 0) {
            return res.status(400).json({ success: false, error: 'Amount must be greater than 0' });
        }
        
        // Get head of account name
        let headOfAccountName = null;
        if (head_of_account_id) {
            const { data: hoa } = await supabase
                .from('heads_of_account')
                .select('name')
                .eq('id', head_of_account_id)
                .single();
            headOfAccountName = hoa?.name;
        }
        
        // Prepare voucher data
        const voucherData = {
            org_id: req.user.org_id,
            company_id,
            payee_id,
            amount: parseFloat(amount),
            payment_mode,
            head_of_account_id,
            head_of_account_name: headOfAccountName,
            description,
            remarks,
            upi_id: payment_mode === 'upi' ? upi_id : null,
            bank_account_number: payment_mode === 'account_transfer' ? bank_account_number : null,
            cheque_number: payment_mode === 'cheque' ? cheque_number : null,
            cheque_date: payment_mode === 'cheque' ? cheque_date : null,
            attachments: attachments || [],
            status: 'pending_approval',
            created_by: req.user.id,
            created_at: new Date().toISOString()
        };
        
        // Create voucher
        const { data: voucher, error: createError } = await supabase
            .from('vouchers')
            .insert(voucherData)
            .select()
            .single();
        
        if (createError) {
            throw createError;
        }
        
        // Generate digital signature
        try {
            const signatureData = {
                voucher_number: voucher.voucher_number,
                company_id: voucher.company_id,
                org_id: voucher.org_id,
                payee_id: voucher.payee_id,
                amount: voucher.amount,
                payment_mode: voucher.payment_mode,
                head_of_account: headOfAccountName,
                created_at: voucher.created_at,
                created_by: voucher.created_by
            };
            
            const signatureResult = await signVoucher(signatureData, req.user.org_id);
            
            // Update voucher with signature
            await supabase
                .from('vouchers')
                .update({
                    digital_signature: signatureResult.signature,
                    signature_timestamp: signatureResult.timestamp
                })
                .eq('id', voucher.id);
            
            voucher.digital_signature = signatureResult.signature;
            voucher.signature_timestamp = signatureResult.timestamp;
            
            logger.info('Voucher created with digital signature', {
                voucher_id: voucher.id,
                voucher_number: voucher.voucher_number
            });
        } catch (signError) {
            logger.warn('Failed to sign voucher, continuing without signature', {
                error: signError.message,
                voucher_id: voucher.id
            });
        }
        
        // Create audit log entry
        await supabase
            .from('voucher_audit_log')
            .insert({
                voucher_id: voucher.id,
                action: 'created',
                performed_by: req.user.id,
                performed_by_name: req.user.full_name,
                performed_by_role: req.user.role,
                new_values: voucherData,
                ip_address: req.ip,
                user_agent: req.get('user-agent')
            });
        
        // Update license voucher usage
        await updateVoucherUsage(req.user.org_id);
        
        res.status(201).json({
            success: true,
            message: 'Voucher created successfully',
            data: voucher
        });
        
    } catch (error) {
        logger.error('Failed to create voucher', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to create voucher' });
    }
});

/**
 * PUT /api/vouchers/:id - Update a voucher (only if pending)
 */
router.put('/:id', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { id } = req.params;
        
        // Get existing voucher
        const { data: existingVoucher, error: fetchError } = await supabase
            .from('vouchers')
            .select('*')
            .eq('id', id)
            .eq('org_id', req.user.org_id)
            .single();
        
        if (fetchError || !existingVoucher) {
            return res.status(404).json({ success: false, error: 'Voucher not found' });
        }
        
        // Only allow updates for draft or pending_approval vouchers
        if (!['draft', 'pending_approval'].includes(existingVoucher.status)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot modify voucher after approval' 
            });
        }
        
        const {
            payee_id,
            amount,
            payment_mode,
            head_of_account_id,
            description,
            remarks,
            upi_id,
            bank_account_number,
            cheque_number,
            cheque_date,
            attachments
        } = req.body;
        
        // Get head of account name
        let headOfAccountName = existingVoucher.head_of_account_name;
        if (head_of_account_id && head_of_account_id !== existingVoucher.head_of_account_id) {
            const { data: hoa } = await supabase
                .from('heads_of_account')
                .select('name')
                .eq('id', head_of_account_id)
                .single();
            headOfAccountName = hoa?.name;
        }
        
        const updateData = {
            payee_id: payee_id || existingVoucher.payee_id,
            amount: amount ? parseFloat(amount) : existingVoucher.amount,
            payment_mode: payment_mode || existingVoucher.payment_mode,
            head_of_account_id: head_of_account_id || existingVoucher.head_of_account_id,
            head_of_account_name: headOfAccountName,
            description: description || existingVoucher.description,
            remarks: remarks !== undefined ? remarks : existingVoucher.remarks,
            upi_id: upi_id,
            bank_account_number: bank_account_number,
            cheque_number: cheque_number,
            cheque_date: cheque_date,
            attachments: attachments || existingVoucher.attachments,
            updated_at: new Date().toISOString()
        };
        
        // Update voucher
        const { data: updatedVoucher, error: updateError } = await supabase
            .from('vouchers')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        
        if (updateError) {
            throw updateError;
        }
        
        // Re-sign voucher if amount or critical fields changed
        if (amount !== existingVoucher.amount || payee_id !== existingVoucher.payee_id) {
            try {
                const signatureData = {
                    voucher_number: updatedVoucher.voucher_number,
                    company_id: updatedVoucher.company_id,
                    org_id: updatedVoucher.org_id,
                    payee_id: updatedVoucher.payee_id,
                    amount: updatedVoucher.amount,
                    payment_mode: updatedVoucher.payment_mode,
                    head_of_account: headOfAccountName,
                    created_at: updatedVoucher.created_at,
                    created_by: updatedVoucher.created_by
                };
                
                const signatureResult = await signVoucher(signatureData, req.user.org_id);
                
                await supabase
                    .from('vouchers')
                    .update({
                        digital_signature: signatureResult.signature,
                        signature_timestamp: signatureResult.timestamp
                    })
                    .eq('id', id);
                    
                updatedVoucher.digital_signature = signatureResult.signature;
                updatedVoucher.signature_timestamp = signatureResult.timestamp;
            } catch (signError) {
                logger.warn('Failed to re-sign voucher', { error: signError.message });
            }
        }
        
        // Create audit log entry
        await supabase
            .from('voucher_audit_log')
            .insert({
                voucher_id: id,
                action: 'modified',
                performed_by: req.user.id,
                performed_by_name: req.user.full_name,
                performed_by_role: req.user.role,
                old_values: existingVoucher,
                new_values: updateData,
                ip_address: req.ip,
                user_agent: req.get('user-agent')
            });
        
        res.json({
            success: true,
            message: 'Voucher updated successfully',
            data: updatedVoucher
        });
        
    } catch (error) {
        logger.error('Failed to update voucher', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to update voucher' });
    }
});

/**
 * DELETE /api/vouchers/:id - Delete a voucher (only if draft)
 */
router.delete('/:id', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { id } = req.params;
        
        // Get existing voucher
        const { data: voucher, error: fetchError } = await supabase
            .from('vouchers')
            .select('*')
            .eq('id', id)
            .eq('org_id', req.user.org_id)
            .single();
        
        if (fetchError || !voucher) {
            return res.status(404).json({ success: false, error: 'Voucher not found' });
        }
        
        // Only allow deletion of draft vouchers
        if (voucher.status !== 'draft') {
            return res.status(400).json({ 
                success: false, 
                error: 'Only draft vouchers can be deleted' 
            });
        }
        
        // Delete voucher
        const { error: deleteError } = await supabase
            .from('vouchers')
            .delete()
            .eq('id', id);
        
        if (deleteError) {
            throw deleteError;
        }
        
        logger.info('Voucher deleted', { voucher_id: id, voucher_number: voucher.voucher_number });
        
        res.json({
            success: true,
            message: 'Voucher deleted successfully'
        });
        
    } catch (error) {
        logger.error('Failed to delete voucher', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to delete voucher' });
    }
});

// =====================================================
// APPROVAL WORKFLOW
// =====================================================

/**
 * POST /api/vouchers/:id/approve - Approve a voucher
 */
router.post('/:id/approve', authenticate, verifyLicense, authorize(['admin', 'approver']), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { id } = req.params;
        
        // Get voucher
        const { data: voucher, error: fetchError } = await supabase
            .from('vouchers')
            .select('*')
            .eq('id', id)
            .eq('org_id', req.user.org_id)
            .single();
        
        if (fetchError || !voucher) {
            return res.status(404).json({ success: false, error: 'Voucher not found' });
        }
        
        if (voucher.status !== 'pending_approval') {
            return res.status(400).json({ 
                success: false, 
                error: 'Voucher is not pending approval' 
            });
        }
        
        // Verify signature before approval
        try {
            const signatureData = {
                voucher_number: voucher.voucher_number,
                company_id: voucher.company_id,
                org_id: voucher.org_id,
                payee_id: voucher.payee_id,
                amount: voucher.amount,
                payment_mode: voucher.payment_mode,
                head_of_account: voucher.head_of_account_name,
                created_at: voucher.created_at,
                created_by: voucher.created_by
            };
            
            const verifyResult = await verifyVoucher(
                signatureData, 
                voucher.digital_signature, 
                req.user.org_id
            );
            
            if (!verifyResult.valid) {
                logger.error('Signature verification failed during approval', {
                    voucher_id: id,
                    voucher_number: voucher.voucher_number
                });
                
                return res.status(400).json({
                    success: false,
                    error: 'Signature verification failed - voucher may have been tampered with'
                });
            }
        } catch (signError) {
            logger.warn('Could not verify signature during approval', { error: signError.message });
        }
        
        // Update voucher status
        const { data: updatedVoucher, error: updateError } = await supabase
            .from('vouchers')
            .update({
                status: 'approved',
                approved_by: req.user.id,
                approved_at: new Date().toISOString(),
                signature_verified: true,
                last_verification_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
        
        if (updateError) {
            throw updateError;
        }
        
        // Create audit log entry
        await supabase
            .from('voucher_audit_log')
            .insert({
                voucher_id: id,
                action: 'approved',
                performed_by: req.user.id,
                performed_by_name: req.user.full_name,
                performed_by_role: req.user.role,
                old_values: { status: 'pending_approval' },
                new_values: { status: 'approved', approved_by: req.user.id },
                ip_address: req.ip,
                user_agent: req.get('user-agent')
            });
        
        logger.info('Voucher approved', {
            voucher_id: id,
            voucher_number: voucher.voucher_number,
            approved_by: req.user.id
        });
        
        res.json({
            success: true,
            message: 'Voucher approved successfully',
            data: updatedVoucher
        });
        
    } catch (error) {
        logger.error('Failed to approve voucher', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to approve voucher' });
    }
});

/**
 * POST /api/vouchers/:id/reject - Reject a voucher
 */
router.post('/:id/reject', authenticate, verifyLicense, authorize(['admin', 'approver']), async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { id } = req.params;
        const { rejection_reason } = req.body;
        
        if (!rejection_reason) {
            return res.status(400).json({ 
                success: false, 
                error: 'Rejection reason is required' 
            });
        }
        
        // Get voucher
        const { data: voucher, error: fetchError } = await supabase
            .from('vouchers')
            .select('*')
            .eq('id', id)
            .eq('org_id', req.user.org_id)
            .single();
        
        if (fetchError || !voucher) {
            return res.status(404).json({ success: false, error: 'Voucher not found' });
        }
        
        if (voucher.status !== 'pending_approval') {
            return res.status(400).json({ 
                success: false, 
                error: 'Voucher is not pending approval' 
            });
        }
        
        // Update voucher status
        const { data: updatedVoucher, error: updateError } = await supabase
            .from('vouchers')
            .update({
                status: 'rejected',
                rejected_by: req.user.id,
                rejected_at: new Date().toISOString(),
                rejection_reason
            })
            .eq('id', id)
            .select()
            .single();
        
        if (updateError) {
            throw updateError;
        }
        
        // Create audit log entry
        await supabase
            .from('voucher_audit_log')
            .insert({
                voucher_id: id,
                action: 'rejected',
                performed_by: req.user.id,
                performed_by_name: req.user.full_name,
                performed_by_role: req.user.role,
                old_values: { status: 'pending_approval' },
                new_values: { status: 'rejected', rejection_reason },
                notes: rejection_reason,
                ip_address: req.ip,
                user_agent: req.get('user-agent')
            });
        
        logger.info('Voucher rejected', {
            voucher_id: id,
            voucher_number: voucher.voucher_number,
            rejected_by: req.user.id,
            reason: rejection_reason
        });
        
        res.json({
            success: true,
            message: 'Voucher rejected',
            data: updatedVoucher
        });
        
    } catch (error) {
        logger.error('Failed to reject voucher', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to reject voucher' });
    }
});

// =====================================================
// OTP VERIFICATION FOR PAYMENT
// =====================================================

/**
 * POST /api/vouchers/:id/send-otp - Send OTP to payee for payment verification
 */
router.post('/:id/send-otp', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { id } = req.params;
        
        // Get voucher with payee details
        const { data: voucher, error: fetchError } = await supabase
            .from('vouchers')
            .select(`
                *,
                payee:payees(id, name, mobile)
            `)
            .eq('id', id)
            .eq('org_id', req.user.org_id)
            .single();
        
        if (fetchError || !voucher) {
            return res.status(404).json({ success: false, error: 'Voucher not found' });
        }
        
        if (voucher.status !== 'approved') {
            return res.status(400).json({ 
                success: false, 
                error: 'Voucher must be approved before sending OTP' 
            });
        }
        
        if (!voucher.payee?.mobile) {
            return res.status(400).json({ 
                success: false, 
                error: 'Payee mobile number not found' 
            });
        }
        
        // Send OTP using SMS service
        const smsService = await SMSService.forOrganization(req.user.org_id);
        
        if (!smsService) {
            // Use default 2Factor service
            const defaultSMS = SMSService.createDefault();
            const result = await defaultSMS.send2FactorAutoOTP(voucher.payee.mobile);
            
            if (!result.success) {
                return res.status(500).json({ success: false, error: result.error });
            }
            
            // Store session ID for verification
            await supabase
                .from('vouchers')
                .update({ 
                    otp_session_id: result.sessionId,
                    otp_sent_at: new Date().toISOString()
                })
                .eq('id', id);
            
            return res.json({
                success: true,
                message: 'OTP sent to payee mobile',
                otp_sent_to: maskMobile(voucher.payee.mobile)
            });
        }
        
        // Use org-specific SMS service
        const result = await smsService.sendOTP(
            voucher.payee.mobile,
            'otp_payment_verification',
            [],
            id
        );
        
        if (!result.success) {
            return res.status(500).json({ success: false, error: result.error });
        }
        
        // Store session ID for verification
        await supabase
            .from('vouchers')
            .update({ 
                otp_session_id: result.sessionId || result.messageId,
                otp_sent_at: new Date().toISOString()
            })
            .eq('id', id);
        
        res.json({
            success: true,
            message: 'OTP sent to payee mobile',
            otp_sent_to: maskMobile(voucher.payee.mobile)
        });
        
    } catch (error) {
        logger.error('Failed to send OTP', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to send OTP' });
    }
});

/**
 * POST /api/vouchers/:id/verify-otp - Verify OTP and complete payment
 */
router.post('/:id/verify-otp', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { id } = req.params;
        const { otp } = req.body;
        
        if (!otp) {
            return res.status(400).json({ success: false, error: 'OTP is required' });
        }
        
        // Get voucher
        const { data: voucher, error: fetchError } = await supabase
            .from('vouchers')
            .select('*')
            .eq('id', id)
            .eq('org_id', req.user.org_id)
            .single();
        
        if (fetchError || !voucher) {
            return res.status(404).json({ success: false, error: 'Voucher not found' });
        }
        
        if (voucher.status !== 'approved') {
            return res.status(400).json({ 
                success: false, 
                error: 'Voucher must be approved' 
            });
        }
        
        if (!voucher.otp_session_id) {
            return res.status(400).json({ 
                success: false, 
                error: 'OTP not sent. Please request OTP first.' 
            });
        }
        
        // Check if OTP is expired (10 minutes)
        const otpSentAt = new Date(voucher.otp_sent_at);
        const now = new Date();
        const diffMinutes = (now - otpSentAt) / (1000 * 60);
        
        if (diffMinutes > 10) {
            return res.status(400).json({ 
                success: false, 
                error: 'OTP expired. Please request a new OTP.' 
            });
        }
        
        // Verify OTP using 2Factor
        const smsService = SMSService.createDefault();
        const verifyResult = await smsService.verify2FactorOTP(voucher.otp_session_id, otp);
        
        if (!verifyResult.success) {
            // Log failed attempt
            await supabase
                .from('voucher_audit_log')
                .insert({
                    voucher_id: id,
                    action: 'otp_failed',
                    performed_by: req.user.id,
                    performed_by_name: req.user.full_name,
                    performed_by_role: req.user.role,
                    notes: 'Invalid OTP entered',
                    ip_address: req.ip
                });
            
            return res.status(400).json({ success: false, error: 'Invalid OTP' });
        }
        
        // Update voucher as completed
        const { data: updatedVoucher, error: updateError } = await supabase
            .from('vouchers')
            .update({
                status: 'completed',
                payee_otp_verified: true,
                payee_otp_verified_at: new Date().toISOString(),
                completed_by: req.user.id,
                completed_at: new Date().toISOString(),
                otp_session_id: null // Clear session
            })
            .eq('id', id)
            .select()
            .single();
        
        if (updateError) {
            throw updateError;
        }
        
        // Create audit log entry
        await supabase
            .from('voucher_audit_log')
            .insert({
                voucher_id: id,
                action: 'completed',
                performed_by: req.user.id,
                performed_by_name: req.user.full_name,
                performed_by_role: req.user.role,
                old_values: { status: 'approved' },
                new_values: { status: 'completed', payee_otp_verified: true },
                notes: 'Payment completed with OTP verification',
                ip_address: req.ip,
                user_agent: req.get('user-agent')
            });
        
        logger.info('Voucher completed with OTP verification', {
            voucher_id: id,
            voucher_number: voucher.voucher_number
        });
        
        res.json({
            success: true,
            message: 'Payment verified and completed successfully',
            data: updatedVoucher
        });
        
    } catch (error) {
        logger.error('Failed to verify OTP', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to verify OTP' });
    }
});

/**
 * POST /api/vouchers/:id/cancel - Cancel a voucher
 */
router.post('/:id/cancel', authenticate, verifyLicense, async (req, res) => {
    try {
        const supabase = getSupabaseClient();
        const { id } = req.params;
        const { cancellation_reason } = req.body;
        
        // Get voucher
        const { data: voucher, error: fetchError } = await supabase
            .from('vouchers')
            .select('*')
            .eq('id', id)
            .eq('org_id', req.user.org_id)
            .single();
        
        if (fetchError || !voucher) {
            return res.status(404).json({ success: false, error: 'Voucher not found' });
        }
        
        if (voucher.status === 'completed') {
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot cancel a completed voucher' 
            });
        }
        
        if (voucher.status === 'cancelled') {
            return res.status(400).json({ 
                success: false, 
                error: 'Voucher is already cancelled' 
            });
        }
        
        // Update voucher status
        const { data: updatedVoucher, error: updateError } = await supabase
            .from('vouchers')
            .update({
                status: 'cancelled',
                cancelled_by: req.user.id,
                cancelled_at: new Date().toISOString(),
                cancellation_reason
            })
            .eq('id', id)
            .select()
            .single();
        
        if (updateError) {
            throw updateError;
        }
        
        // Create audit log entry
        await supabase
            .from('voucher_audit_log')
            .insert({
                voucher_id: id,
                action: 'cancelled',
                performed_by: req.user.id,
                performed_by_name: req.user.full_name,
                performed_by_role: req.user.role,
                old_values: { status: voucher.status },
                new_values: { status: 'cancelled' },
                notes: cancellation_reason,
                ip_address: req.ip,
                user_agent: req.get('user-agent')
            });
        
        logger.info('Voucher cancelled', {
            voucher_id: id,
            voucher_number: voucher.voucher_number,
            reason: cancellation_reason
        });
        
        res.json({
            success: true,
            message: 'Voucher cancelled',
            data: updatedVoucher
        });
        
    } catch (error) {
        logger.error('Failed to cancel voucher', { error: error.message });
        res.status(500).json({ success: false, error: 'Failed to cancel voucher' });
    }
});

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Mask mobile number for display
 */
function maskMobile(mobile) {
    if (!mobile) return '';
    const cleaned = mobile.replace(/\D/g, '');
    if (cleaned.length < 4) return '****';
    return `****${cleaned.slice(-4)}`;
}

/**
 * Update license voucher usage
 */
async function updateVoucherUsage(orgId) {
    try {
        const supabase = getSupabaseClient();
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        // Get org's license
        const { data: org } = await supabase
            .from('licensed_orgs')
            .select('license_id')
            .eq('id', orgId)
            .single();
        
        if (org && org.license_id) {
            // Get current usage
            const { data: usage } = await supabase
                .from('license_usage')
                .select('vouchers_count')
                .eq('license_id', org.license_id)
                .eq('month', currentMonth)
                .single();
            
            if (usage) {
                await supabase
                    .from('license_usage')
                    .update({ 
                        vouchers_count: (usage.vouchers_count || 0) + 1,
                        last_activity: new Date().toISOString()
                    })
                    .eq('license_id', org.license_id)
                    .eq('month', currentMonth);
            } else {
                await supabase
                    .from('license_usage')
                    .insert({
                        license_id: org.license_id,
                        month: currentMonth,
                        vouchers_count: 1,
                        last_activity: new Date().toISOString()
                    });
            }
        }
    } catch (error) {
        logger.error('Failed to update voucher usage', { error: error.message });
    }
}

module.exports = router;
