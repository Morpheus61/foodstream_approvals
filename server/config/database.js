const { createClient } = require('@supabase/supabase-js');
const logger = require('../utils/logger');

/**
 * Supabase Database Client Configuration
 */

let supabaseClient = null;

/**
 * Initialize Supabase client
 */
function getSupabaseClient() {
    if (supabaseClient) {
        return supabaseClient;
    }
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        logger.error('Missing Supabase credentials in environment variables');
        throw new Error('Supabase configuration missing');
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: false
        },
        db: {
            schema: 'public'
        }
    });
    
    logger.info('Supabase client initialized');
    return supabaseClient;
}

/**
 * Set session context for Row Level Security
 */
async function setSessionContext(orgId, userId = null) {
    const client = getSupabaseClient();
    
    const settings = {
        'app.current_org_id': orgId
    };
    
    if (userId) {
        settings['app.current_user_id'] = userId;
    }
    
    for (const [key, value] of Object.entries(settings)) {
        await client.rpc('set_config', {
            setting_name: key,
            setting_value: value.toString(),
            is_local: false
        }).catch(err => {
            logger.error('Failed to set session context', { key, error: err.message });
        });
    }
}

/**
 * Execute query with automatic retry logic
 */
async function executeWithRetry(queryFn, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await queryFn();
        } catch (error) {
            lastError = error;
            logger.warn(`Query attempt ${attempt} failed`, { error: error.message });
            
            if (attempt < maxRetries) {
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            }
        }
    }
    
    throw lastError;
}

/**
 * Health check
 */
async function checkHealth() {
    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('licenses')
            .select('count')
            .limit(1);
        
        return !error;
    } catch (error) {
        logger.error('Database health check failed', { error: error.message });
        return false;
    }
}

module.exports = {
    getSupabaseClient,
    setSessionContext,
    executeWithRetry,
    checkHealth
};
