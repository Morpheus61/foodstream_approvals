/**
 * FoodStream Ltd. - Voucher Digital Signature Service
 * 
 * Provides cryptographic signing and verification for payment vouchers
 * using HMAC-SHA256 algorithm with organization-specific secrets.
 * 
 * @module services/signatureService
 */

const crypto = require('crypto');
const { supabase } = require('../config/database');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

/**
 * Generate a digital signature for a voucher
 * 
 * @param {Object} voucherData - The voucher data to sign
 * @param {string} voucherData.voucher_number - Unique voucher number
 * @param {string} voucherData.company_id - Company UUID
 * @param {string} voucherData.org_id - Organization UUID
 * @param {string} voucherData.payee_id - Payee UUID
 * @param {number} voucherData.amount - Payment amount
 * @param {string} voucherData.payment_mode - Payment method (UPI/Account Transfer/Cash)
 * @param {string} voucherData.head_of_account - Account head category
 * @param {string} voucherData.created_at - ISO timestamp
 * @param {string} voucherData.created_by - User UUID
 * @param {string} orgId - Organization ID to fetch signing secret
 * @returns {Promise<Object>} Signature object with signature and timestamp
 */
async function signVoucher(voucherData, orgId) {
  try {
    // Fetch organization signing secret
    const orgSecret = await getOrgSigningSecret(orgId);
    
    if (!orgSecret) {
      throw new Error('Organization signing secret not found');
    }
    
    // Create canonical string from voucher data
    const canonical = createCanonicalString(voucherData);
    
    // Generate HMAC-SHA256 signature
    const signature = crypto
      .createHmac('sha256', orgSecret)
      .update(canonical)
      .digest('hex');
    
    const timestamp = new Date().toISOString();
    
    logger.info('Voucher signature generated', {
      voucher_number: voucherData.voucher_number,
      org_id: orgId,
      signature_length: signature.length,
      timestamp
    });
    
    return {
      signature,
      timestamp,
      algorithm: 'HMAC-SHA256',
      canonical_string: canonical
    };
    
  } catch (error) {
    logger.error('Failed to sign voucher', {
      error: error.message,
      voucher_number: voucherData.voucher_number,
      org_id: orgId
    });
    throw error;
  }
}

/**
 * Verify a voucher's digital signature
 * 
 * @param {Object} voucherData - The voucher data to verify
 * @param {string} storedSignature - The signature to verify against (64 hex chars)
 * @param {string} orgId - Organization ID
 * @returns {Promise<Object>} Verification result
 */
async function verifyVoucher(voucherData, storedSignature, orgId) {
  try {
    // Generate expected signature
    const { signature: expectedSignature, canonical_string } = await signVoucher(voucherData, orgId);
    
    // Constant-time comparison to prevent timing attacks
    let valid = false;
    try {
      valid = crypto.timingSafeEqual(
        Buffer.from(storedSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (bufferError) {
      // Signatures have different lengths or invalid format
      valid = false;
    }
    
    const result = {
      valid,
      expected_signature: expectedSignature,
      actual_signature: storedSignature,
      match: valid,
      verified_at: new Date().toISOString(),
      canonical_string,
      algorithm: 'HMAC-SHA256'
    };
    
    logger.info('Voucher signature verified', {
      voucher_number: voucherData.voucher_number,
      org_id: orgId,
      valid,
      verified_at: result.verified_at
    });
    
    return result;
    
  } catch (error) {
    logger.error('Failed to verify voucher signature', {
      error: error.message,
      voucher_number: voucherData.voucher_number,
      org_id: orgId
    });
    throw error;
  }
}

/**
 * Verify and log verification attempt
 * 
 * @param {string} voucherId - Voucher UUID
 * @param {Object} voucherData - Voucher data
 * @param {string} storedSignature - Stored signature
 * @param {string} orgId - Organization ID
 * @param {string} userId - User performing verification
 * @returns {Promise<Object>} Verification result with logging
 */
async function verifyAndLog(voucherId, voucherData, storedSignature, orgId, userId) {
  const result = await verifyVoucher(voucherData, storedSignature, orgId);
  
  // Log verification attempt to audit trail
  await logVerification(voucherId, result, userId);
  
  return result;
}

/**
 * Log signature verification attempt to audit trail
 * 
 * @param {string} voucherId - Voucher UUID
 * @param {Object} result - Verification result
 * @param {string} userId - User UUID performing verification
 * @returns {Promise<void>}
 */
async function logVerification(voucherId, result, userId) {
  try {
    const { error } = await supabase
      .from('signature_verifications')
      .insert({
        voucher_id: voucherId,
        verified_at: result.verified_at,
        verified_by: userId,
        verification_result: result.valid ? 'VALID' : 'INVALID',
        signature_checked: result.actual_signature,
        expected_signature: result.expected_signature
      });
    
    if (error) {
      logger.error('Failed to log signature verification', {
        error: error.message,
        voucher_id: voucherId
      });
    }
    
  } catch (error) {
    logger.error('Exception logging verification', {
      error: error.message,
      voucher_id: voucherId
    });
  }
}

/**
 * Create canonical string from voucher data
 * Fields are joined with pipe separator in consistent order
 * 
 * @param {Object} voucherData - Voucher data
 * @returns {string} Canonical string representation
 */
function createCanonicalString(voucherData) {
  const fields = [
    voucherData.voucher_number || '',
    voucherData.company_id || '',
    voucherData.org_id || '',
    voucherData.payee_id || '',
    parseFloat(voucherData.amount || 0).toFixed(2),
    voucherData.payment_mode || '',
    voucherData.head_of_account || '',
    voucherData.created_at || new Date().toISOString(),
    voucherData.created_by || ''
  ];
  
  return fields.join('|');
}

/**
 * Fetch and decrypt organization signing secret
 * 
 * @param {string} orgId - Organization UUID
 * @returns {Promise<string>} Decrypted signing secret
 */
async function getOrgSigningSecret(orgId) {
  try {
    const { data, error } = await supabase
      .from('licensed_orgs')
      .select('org_signing_secret')
      .eq('id', orgId)
      .single();
    
    if (error || !data) {
      throw new Error('Organization not found');
    }
    
    if (!data.org_signing_secret) {
      throw new Error('Organization signing secret not configured');
    }
    
    // Decrypt the secret (stored encrypted in database)
    const decryptedSecret = decrypt(data.org_signing_secret);
    
    return decryptedSecret;
    
  } catch (error) {
    logger.error('Failed to fetch org signing secret', {
      error: error.message,
      org_id: orgId
    });
    throw error;
  }
}

/**
 * Generate a new signing secret for an organization
 * Should be called during organization setup
 * 
 * @returns {string} Random 32-character signing secret
 */
function generateSigningSecret() {
  return crypto.randomBytes(32).toString('hex'); // 64 hex chars
}

/**
 * Rotate organization signing secret
 * Re-signs all existing vouchers with new secret
 * 
 * @param {string} orgId - Organization UUID
 * @returns {Promise<Object>} Rotation result with stats
 */
async function rotateOrgSigningSecret(orgId) {
  try {
    logger.warn('Signing secret rotation initiated', { org_id: orgId });
    
    // Generate new secret
    const newSecret = generateSigningSecret();
    
    // Fetch all vouchers for this org
    const { data: vouchers, error: fetchError } = await supabase
      .from('vouchers')
      .select('id, voucher_number, company_id, org_id, payee_id, amount, payment_mode, head_of_account, created_at, created_by')
      .eq('org_id', orgId);
    
    if (fetchError) throw fetchError;
    
    // Re-sign all vouchers with new secret
    let resignedCount = 0;
    let failedCount = 0;
    
    for (const voucher of vouchers) {
      try {
        // Generate new signature with new secret
        const canonical = createCanonicalString(voucher);
        const newSignature = crypto
          .createHmac('sha256', newSecret)
          .update(canonical)
          .digest('hex');
        
        // Update voucher with new signature
        const { error: updateError } = await supabase
          .from('vouchers')
          .update({
            digital_signature: newSignature,
            signature_timestamp: new Date().toISOString()
          })
          .eq('id', voucher.id);
        
        if (updateError) {
          failedCount++;
          logger.error('Failed to re-sign voucher', {
            voucher_id: voucher.id,
            error: updateError.message
          });
        } else {
          resignedCount++;
        }
        
      } catch (voucherError) {
        failedCount++;
        logger.error('Exception re-signing voucher', {
          voucher_id: voucher.id,
          error: voucherError.message
        });
      }
    }
    
    // Update organization with new secret (encrypt before storing)
    const { encrypt } = require('../utils/encryption');
    const encryptedSecret = encrypt(newSecret);
    
    const { error: updateOrgError } = await supabase
      .from('licensed_orgs')
      .update({
        org_signing_secret: encryptedSecret,
        secret_rotated_at: new Date().toISOString()
      })
      .eq('id', orgId);
    
    if (updateOrgError) throw updateOrgError;
    
    logger.info('Signing secret rotation completed', {
      org_id: orgId,
      total_vouchers: vouchers.length,
      resigned: resignedCount,
      failed: failedCount
    });
    
    return {
      success: true,
      total_vouchers: vouchers.length,
      resigned_count: resignedCount,
      failed_count: failedCount,
      rotated_at: new Date().toISOString()
    };
    
  } catch (error) {
    logger.error('Signing secret rotation failed', {
      error: error.message,
      org_id: orgId
    });
    throw error;
  }
}

/**
 * Batch verify multiple vouchers
 * 
 * @param {Array<Object>} vouchers - Array of vouchers with signature data
 * @param {string} orgId - Organization ID
 * @returns {Promise<Array>} Array of verification results
 */
async function batchVerifyVouchers(vouchers, orgId) {
  const results = [];
  
  for (const voucher of vouchers) {
    try {
      const result = await verifyVoucher(
        voucher,
        voucher.digital_signature,
        orgId
      );
      results.push({
        voucher_id: voucher.id,
        voucher_number: voucher.voucher_number,
        ...result
      });
    } catch (error) {
      results.push({
        voucher_id: voucher.id,
        voucher_number: voucher.voucher_number,
        valid: false,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * Get verification history for a voucher
 * 
 * @param {string} voucherId - Voucher UUID
 * @returns {Promise<Array>} Array of verification logs
 */
async function getVerificationHistory(voucherId) {
  const { data, error } = await supabase
    .from('signature_verifications')
    .select(`
      *,
      verified_by_user:users!verified_by(full_name, email, role)
    `)
    .eq('voucher_id', voucherId)
    .order('verified_at', { ascending: false });
  
  if (error) {
    logger.error('Failed to fetch verification history', {
      error: error.message,
      voucher_id: voucherId
    });
    return [];
  }
  
  return data || [];
}

module.exports = {
  signVoucher,
  verifyVoucher,
  verifyAndLog,
  logVerification,
  createCanonicalString,
  getOrgSigningSecret,
  generateSigningSecret,
  rotateOrgSigningSecret,
  batchVerifyVouchers,
  getVerificationHistory
};
