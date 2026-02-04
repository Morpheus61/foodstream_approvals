const { getSupabaseClient } = require('../config/database');
const encryptionUtil = require('../utils/encryption');
const logger = require('../utils/logger');
const axios = require('axios');

/**
 * SMS Service - Multi-Provider Support
 * Supports: 2Factor.in (default), Twilio, MSG91, Kaleyra, TextLocal
 */
class SMSService {
    constructor(orgConfig) {
        // Use 2Factor as default provider, can be overridden by org config or env
        this.provider = orgConfig?.sms_provider || process.env.SMS_PROVIDER || '2factor';
        this.config = orgConfig?.sms_config ? encryptionUtil.decrypt(orgConfig.sms_config) : null;
        this.dltEntityId = orgConfig?.dlt_entity_id;
        this.dltSenderId = orgConfig?.dlt_sender_id;
        this.orgId = orgConfig?.id;
        this.enabled = orgConfig?.sms_enabled !== false;
        
        // 2Factor.in configuration from environment
        this.twoFactorApiKey = process.env.TWOFACTOR_API_KEY;
        this.twoFactorTemplateName = process.env.TWOFACTOR_TEMPLATE_NAME;
    }
    
    /**
     * Generate a 6-digit OTP
     */
    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
    
    /**
     * Send OTP SMS
     */
    async sendOTP(mobile, templateType, variables = [], contextId = null) {
        try {
            if (!this.enabled && this.provider !== '2factor') {
                logger.warn('SMS service disabled for organization', { orgId: this.orgId });
                return { success: false, error: 'SMS service disabled' };
            }
            
            // For 2Factor, we can send OTP directly without DLT template lookup
            if (this.provider === '2factor') {
                const otp = variables[0] || this.generateOTP();
                const result = await this.send2Factor(mobile, otp);
                
                // Log SMS
                await this.logSMS(mobile, `OTP: ${otp}`, null, result, contextId, templateType);
                
                return { ...result, otp };
            }
            
            // Get DLT template for other providers
            const template = await this.getDLTTemplate(templateType);
            
            if (!template) {
                logger.error('DLT template not found', { templateType, orgId: this.orgId });
                return { success: false, error: 'SMS template not configured' };
            }
            
            // Format message with variables
            const message = this.formatTemplate(template.template_content, variables);
            
            // Send via provider
            let result;
            switch(this.provider) {
                case 'twilio':
                    result = await this.sendTwilio(mobile, message, template.dlt_template_id);
                    break;
                
                case 'msg91':
                    result = await this.sendMsg91(mobile, template.dlt_template_id, variables);
                    break;
                
                case 'kaleyra':
                    result = await this.sendKaleyra(mobile, message, template.dlt_template_id);
                    break;
                
                case 'textlocal':
                    result = await this.sendTextLocal(mobile, message, template.dlt_template_id);
                    break;
                
                default:
                    throw new Error(`Unsupported SMS provider: ${this.provider}`);
            }
            
            // Log SMS
            await this.logSMS(mobile, message, template.id, result, contextId, templateType);
            
            return result;
            
        } catch (error) {
            logger.error('SMS send error', { error: error.message, provider: this.provider });
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 2Factor.in - Send OTP with custom OTP value
     */
    async send2Factor(mobile, otp) {
        try {
            // Clean mobile number - remove country code if present
            const cleanMobile = mobile.replace(/^\+91/, '').replace(/^91/, '').replace(/\D/g, '');
            
            if (cleanMobile.length !== 10) {
                return { success: false, error: 'Invalid mobile number format' };
            }
            
            // Send OTP via 2Factor.in
            const url = `https://2factor.in/API/V1/${this.twoFactorApiKey}/SMS/${cleanMobile}/${otp}/${this.twoFactorTemplateName}`;
            
            const response = await axios.get(url);
            
            if (response.data.Status === 'Success') {
                logger.info('2Factor OTP sent successfully', { 
                    mobile: cleanMobile, 
                    sessionId: response.data.Details 
                });
                
                return { 
                    success: true, 
                    messageId: response.data.Details,
                    sessionId: response.data.Details,
                    status: 'sent'
                };
            } else {
                logger.error('2Factor OTP failed', { 
                    mobile: cleanMobile, 
                    error: response.data.Details 
                });
                
                return { 
                    success: false, 
                    error: response.data.Details || 'Failed to send OTP'
                };
            }
        } catch (error) {
            logger.error('2Factor API error', { error: error.message });
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 2Factor.in - Send OTP with auto-generated OTP
     */
    async send2FactorAutoOTP(mobile) {
        try {
            // Clean mobile number
            const cleanMobile = mobile.replace(/^\+91/, '').replace(/^91/, '').replace(/\D/g, '');
            
            if (cleanMobile.length !== 10) {
                return { success: false, error: 'Invalid mobile number format' };
            }
            
            // Auto-generate and send OTP via 2Factor.in
            const url = `https://2factor.in/API/V1/${this.twoFactorApiKey}/SMS/${cleanMobile}/AUTOGEN/${this.twoFactorTemplateName}`;
            
            const response = await axios.get(url);
            
            if (response.data.Status === 'Success') {
                logger.info('2Factor auto OTP sent', { 
                    mobile: cleanMobile, 
                    sessionId: response.data.Details 
                });
                
                return { 
                    success: true, 
                    sessionId: response.data.Details,
                    status: 'sent'
                };
            } else {
                return { 
                    success: false, 
                    error: response.data.Details || 'Failed to send OTP'
                };
            }
        } catch (error) {
            logger.error('2Factor auto OTP error', { error: error.message });
            return { success: false, error: error.message };
        }
    }
    
    /**
     * 2Factor.in - Verify OTP
     */
    async verify2FactorOTP(sessionId, otp) {
        try {
            const url = `https://2factor.in/API/V1/${this.twoFactorApiKey}/SMS/VERIFY/${sessionId}/${otp}`;
            
            const response = await axios.get(url);
            
            if (response.data.Status === 'Success' && response.data.Details === 'OTP Matched') {
                logger.info('2Factor OTP verified', { sessionId });
                return { success: true, message: 'OTP verified successfully' };
            } else {
                logger.warn('2Factor OTP verification failed', { 
                    sessionId, 
                    details: response.data.Details 
                });
                return { success: false, error: 'Invalid OTP' };
            }
        } catch (error) {
            logger.error('2Factor OTP verification error', { error: error.message });
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Twilio SMS
     */
    async sendTwilio(mobile, message, dltTemplateId) {
        try {
            const twilio = require('twilio');
            const client = twilio(this.config.accountSid, this.config.authToken);
            
            const result = await client.messages.create({
                body: message,
                from: this.config.fromNumber,
                to: mobile,
                messagingServiceSid: this.config.messagingServiceSid,
                // DLT parameters for Indian numbers
                ...(mobile.startsWith('+91') && {
                    contentSid: dltTemplateId
                })
            });
            
            return { 
                success: true, 
                messageId: result.sid,
                status: result.status
            };
        } catch (error) {
            logger.error('Twilio error', { error: error.message });
            return { success: false, error: error.message };
        }
    }
    
    /**
     * MSG91 SMS
     */
    async sendMsg91(mobile, dltTemplateId, variables) {
        try {
            const axios = require('axios');
            
            const response = await axios.post('https://api.msg91.com/api/v5/otp', {
                template_id: dltTemplateId,
                mobile: mobile,
                authkey: this.config.authKey,
                otp_length: 6,
                otp_expiry: 10, // minutes
                invisible: 0,
                DLT_TE_ID: dltTemplateId,
                DLT_PE_ID: this.dltEntityId,
                sender: this.dltSenderId
            });
            
            return { 
                success: true, 
                messageId: response.data.request_id,
                status: 'queued'
            };
        } catch (error) {
            logger.error('MSG91 error', { error: error.message });
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Kaleyra SMS
     */
    async sendKaleyra(mobile, message, dltTemplateId) {
        try {
            const axios = require('axios');
            
            const response = await axios.get('https://api.kaleyra.io/v1/HXAP1734713361IN/messages', {
                params: {
                    'api_key': this.config.apiKey,
                    'method': 'sms',
                    'message': message,
                    'to': mobile,
                    'sender': this.dltSenderId,
                    'template_id': dltTemplateId,
                    'pe_id': this.dltEntityId
                }
            });
            
            return { 
                success: true, 
                messageId: response.data.id,
                status: 'queued'
            };
        } catch (error) {
            logger.error('Kaleyra error', { error: error.message });
            return { success: false, error: error.message };
        }
    }
    
    /**
     * TextLocal SMS
     */
    async sendTextLocal(mobile, message, dltTemplateId) {
        try {
            const axios = require('axios');
            
            const response = await axios.post('https://api.textlocal.in/send/', null, {
                params: {
                    apikey: this.config.apiKey,
                    message: message,
                    sender: this.dltSenderId,
                    numbers: mobile,
                    template_id: dltTemplateId
                }
            });
            
            return { 
                success: response.data.status === 'success', 
                messageId: response.data.message_id,
                status: 'queued'
            };
        } catch (error) {
            logger.error('TextLocal error', { error: error.message });
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Get DLT template from database
     */
    async getDLTTemplate(templateType) {
        const supabase = getSupabaseClient();
        
        const { data, error } = await supabase
            .from('sms_templates')
            .select('*')
            .eq('org_id', this.orgId)
            .eq('template_type', templateType)
            .eq('status', 'active')
            .single();
        
        if (error) {
            logger.error('Failed to fetch DLT template', { error: error.message });
            return null;
        }
        
        return data;
    }
    
    /**
     * Format template with variables
     */
    formatTemplate(template, variables) {
        let message = template;
        
        variables.forEach(value => {
            message = message.replace('{#var#}', value);
        });
        
        return message;
    }
    
    /**
     * Log SMS to database
     */
    async logSMS(mobile, message, templateId, result, contextId, contextType) {
        try {
            const supabase = getSupabaseClient();
            
            await supabase
                .from('sms_logs')
                .insert({
                    org_id: this.orgId,
                    mobile: mobile,
                    message: message,
                    template_id: templateId,
                    provider: this.provider,
                    provider_message_id: result.messageId || result.sessionId,
                    status: result.success ? 'sent' : 'failed',
                    error_message: result.error,
                    context_type: contextType,
                    context_id: contextId,
                    credits_used: result.success ? 1.0 : 0
                });
            
            // Update license SMS usage
            if (result.success) {
                await this.updateSMSUsage();
            }
            
        } catch (error) {
            logger.error('Failed to log SMS', { error: error.message });
        }
    }
    
    /**
     * Update SMS usage counter
     */
    async updateSMSUsage() {
        try {
            const supabase = getSupabaseClient();
            const currentMonth = new Date().toISOString().slice(0, 7);
            
            // Get org's license
            const { data: org } = await supabase
                .from('licensed_orgs')
                .select('license_id')
                .eq('id', this.orgId)
                .single();
            
            if (org && org.license_id) {
                // Upsert usage
                await supabase
                    .from('license_usage')
                    .upsert({
                        license_id: org.license_id,
                        month: currentMonth,
                        sms_sent: 1
                    }, {
                        onConflict: 'license_id,month',
                        count: 'exact'
                    });
            }
        } catch (error) {
            logger.error('Failed to update SMS usage', { error: error.message });
        }
    }
    
    /**
     * Static: Create SMS service for organization
     */
    static async forOrganization(orgId) {
        const supabase = getSupabaseClient();
        
        const { data: org, error } = await supabase
            .from('licensed_orgs')
            .select('*')
            .eq('id', orgId)
            .single();
        
        if (error || !org) {
            logger.error('Organization not found for SMS service', { orgId });
            // Return default SMS service with 2Factor
            return new SMSService({});
        }
        
        return new SMSService(org);
    }
    
    /**
     * Static: Create default SMS service (uses 2Factor from env)
     */
    static createDefault() {
        return new SMSService({});
    }
}

module.exports = SMSService;
