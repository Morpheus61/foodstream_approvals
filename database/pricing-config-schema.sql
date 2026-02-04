-- =====================================================
-- PRICING CONFIGURATION TABLE
-- Add this to your existing schema
-- =====================================================

-- Pricing Plans Configuration Table
CREATE TABLE pricing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Plan Details
    plan_code VARCHAR(50) UNIQUE NOT NULL, -- 'trial', 'basic', 'premium', 'enterprise'
    plan_name VARCHAR(100) NOT NULL,
    plan_description TEXT,
    
    -- Pricing
    price_monthly DECIMAL(10,2) DEFAULT 0.00,
    price_annual DECIMAL(10,2) DEFAULT 0.00, -- Annual price (usually discounted)
    currency VARCHAR(3) DEFAULT 'HKD',
    
    -- Limits
    max_companies INTEGER DEFAULT 1,
    max_users INTEGER DEFAULT 5,
    max_vouchers_per_month INTEGER DEFAULT 100,
    sms_credits INTEGER DEFAULT 100,
    api_calls_per_day INTEGER DEFAULT 1000,
    
    -- Features (JSON)
    features JSONB DEFAULT '{
        "print": true,
        "reports": true,
        "api_access": false,
        "custom_domain": false,
        "white_label": true,
        "multi_company": false,
        "advanced_analytics": false,
        "bulk_operations": false,
        "data_export": false,
        "custom_integration": false,
        "dedicated_support": false,
        "sla_guarantee": false
    }'::jsonb,
    
    -- Display
    display_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    badge_text VARCHAR(50), -- 'Popular', 'Best Value', etc.
    
    -- Trial Settings
    trial_days INTEGER DEFAULT 30,
    trial_requires_card BOOLEAN DEFAULT false,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Pricing Add-ons Table
CREATE TABLE pricing_addons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Add-on Details
    addon_code VARCHAR(50) UNIQUE NOT NULL,
    addon_name VARCHAR(100) NOT NULL,
    addon_description TEXT,
    addon_category VARCHAR(50), -- 'sms', 'users', 'companies', 'storage', etc.
    
    -- Pricing
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'HKD',
    billing_type VARCHAR(20) DEFAULT 'monthly' CHECK (billing_type IN ('monthly', 'one_time', 'per_unit')),
    
    -- Quantity
    quantity INTEGER DEFAULT 1, -- e.g., 1000 SMS credits
    unit_label VARCHAR(50), -- 'credits', 'users', 'GB', etc.
    
    -- Availability
    available_for_plans TEXT[], -- Array of plan codes: ['basic', 'premium']
    
    -- Display
    display_order INTEGER DEFAULT 0,
    is_visible BOOLEAN DEFAULT true,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert Default Pricing Plans
INSERT INTO pricing_plans (plan_code, plan_name, plan_description, price_monthly, price_annual, max_companies, max_users, max_vouchers_per_month, sms_credits, features, display_order, trial_days) VALUES

-- Trial Plan
('trial', 'Trial', '30-day free trial with basic features', 0.00, 0.00, 1, 3, 50, 100, 
'{
    "print": false,
    "reports": true,
    "api_access": false,
    "custom_domain": false,
    "white_label": true,
    "multi_company": false,
    "advanced_analytics": false,
    "bulk_operations": false,
    "data_export": false,
    "custom_integration": false,
    "dedicated_support": false,
    "sla_guarantee": false
}'::jsonb, 1, 30),

-- Basic Plan
('basic', 'Basic', 'Perfect for small businesses', 720.00, 7776.00, 3, 10, 500, 1000,
'{
    "print": true,
    "reports": true,
    "api_access": false,
    "custom_domain": false,
    "white_label": true,
    "multi_company": true,
    "advanced_analytics": false,
    "bulk_operations": false,
    "data_export": false,
    "custom_integration": false,
    "dedicated_support": false,
    "sla_guarantee": false
}'::jsonb, 2, 30),

-- Premium Plan
('premium', 'Premium', 'For growing businesses with advanced needs', 1920.00, 20736.00, 10, 50, 2000, 5000,
'{
    "print": true,
    "reports": true,
    "api_access": true,
    "custom_domain": true,
    "white_label": true,
    "multi_company": true,
    "advanced_analytics": true,
    "bulk_operations": true,
    "data_export": true,
    "custom_integration": false,
    "dedicated_support": false,
    "sla_guarantee": false
}'::jsonb, 3, 30),

-- Enterprise Plan
('enterprise', 'Enterprise', 'Unlimited everything with dedicated support', 0.00, 0.00, -1, -1, -1, -1,
'{
    "print": true,
    "reports": true,
    "api_access": true,
    "custom_domain": true,
    "white_label": true,
    "multi_company": true,
    "advanced_analytics": true,
    "bulk_operations": true,
    "data_export": true,
    "custom_integration": true,
    "dedicated_support": true,
    "sla_guarantee": true
}'::jsonb, 4, 30);

-- Insert Default Add-ons
INSERT INTO pricing_addons (addon_code, addon_name, addon_description, addon_category, price, quantity, unit_label, available_for_plans) VALUES

-- SMS Add-ons
('sms_1k', 'Extra 1,000 SMS Credits', 'Additional SMS credits for your account', 'sms', 96.00, 1000, 'credits', ARRAY['basic', 'premium']),
('sms_5k', 'Extra 5,000 SMS Credits', 'Bulk SMS credits with 10% discount', 'sms', 432.00, 5000, 'credits', ARRAY['basic', 'premium']),
('sms_10k', 'Extra 10,000 SMS Credits', 'Large SMS pack with 20% discount', 'sms', 768.00, 10000, 'credits', ARRAY['basic', 'premium', 'enterprise']),

-- User Add-ons
('user_1', 'Additional User', 'Add one more user to your account', 'users', 48.00, 1, 'user', ARRAY['basic', 'premium']),
('user_10', '10-User Pack', 'Add 10 users with 10% discount', 'users', 432.00, 10, 'users', ARRAY['basic', 'premium']),

-- Company Add-ons
('company_1', 'Additional Company', 'Add one more company to manage', 'companies', 96.00, 1, 'company', ARRAY['basic', 'premium']),
('company_5', '5-Company Pack', 'Add 5 companies with 10% discount', 'companies', 432.00, 5, 'companies', ARRAY['basic', 'premium']),

-- Services
('setup_training', 'Setup & Training', 'Professional onboarding and training session', 'services', 1920.00, 1, 'session', ARRAY['basic', 'premium', 'enterprise']),
('priority_support', 'Priority Support', 'Dedicated support channel with faster response times', 'support', 960.00, 1, 'month', ARRAY['premium', 'enterprise']);

-- Create indexes
CREATE INDEX idx_pricing_plans_code ON pricing_plans(plan_code);
CREATE INDEX idx_pricing_plans_status ON pricing_plans(status);
CREATE INDEX idx_pricing_plans_visible ON pricing_plans(is_visible);
CREATE INDEX idx_pricing_addons_code ON pricing_addons(addon_code);
CREATE INDEX idx_pricing_addons_category ON pricing_addons(addon_category);

-- Trigger for updated_at
CREATE TRIGGER update_pricing_plans_updated_at BEFORE UPDATE ON pricing_plans 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_addons_updated_at BEFORE UPDATE ON pricing_addons 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View: Current Pricing (for public API)
CREATE OR REPLACE VIEW current_pricing AS
SELECT 
    plan_code,
    plan_name,
    plan_description,
    price_monthly,
    price_annual,
    ROUND((price_annual / 12), 2) as price_monthly_if_annual,
    ROUND(((price_monthly * 12 - price_annual) / (price_monthly * 12) * 100), 0) as annual_discount_percentage,
    currency,
    max_companies,
    max_users,
    max_vouchers_per_month,
    sms_credits,
    features,
    trial_days,
    is_featured,
    badge_text,
    display_order
FROM pricing_plans
WHERE status = 'active' AND is_visible = true
ORDER BY display_order;

-- Grant permissions
GRANT SELECT ON current_pricing TO authenticated;

COMMENT ON TABLE pricing_plans IS 'Configurable pricing plans for the SAAS system';
COMMENT ON TABLE pricing_addons IS 'Optional add-ons and upgrades available for purchase';
COMMENT ON VIEW current_pricing IS 'Public view of active pricing plans';
