-- =====================================================
-- FoodStream Ltd. White Label Payment Approval System
-- Complete Database Schema - Supabase (PostgreSQL)
-- Version: 2.0.0
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. LICENSING SYSTEM TABLES
-- =====================================================

-- Licenses (Top Level - Software Licenses)
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key VARCHAR(255) UNIQUE NOT NULL,
    license_type VARCHAR(50) NOT NULL CHECK (license_type IN ('trial', 'basic', 'premium', 'enterprise')),
    
    -- Licensee Information
    licensee_name VARCHAR(255) NOT NULL,
    licensee_email VARCHAR(255) NOT NULL,
    licensee_mobile VARCHAR(20) NOT NULL,
    licensee_company VARCHAR(255),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired', 'revoked', 'pending')),
    
    -- Limitations
    max_companies INTEGER DEFAULT 1,
    max_users INTEGER DEFAULT 5,
    max_vouchers_per_month INTEGER DEFAULT 100,
    sms_credits INTEGER DEFAULT 100,
    
    -- Dates
    issued_date TIMESTAMP DEFAULT NOW(),
    activation_date TIMESTAMP,
    expiry_date TIMESTAMP,
    last_verified TIMESTAMP,
    
    -- Security
    hardware_id VARCHAR(255),
    ip_whitelist TEXT[],
    allowed_devices INTEGER DEFAULT 1,
    
    -- Features
    features JSONB DEFAULT '{
        "print": true,
        "reports": true,
        "api_access": false,
        "custom_domain": false,
        "white_label": true,
        "multi_company": true,
        "advanced_analytics": false
    }'::jsonb,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- License Usage Tracking (Monthly)
CREATE TABLE license_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- Format: 'YYYY-MM'
    
    -- Usage Metrics
    companies_count INTEGER DEFAULT 0,
    users_count INTEGER DEFAULT 0,
    vouchers_count INTEGER DEFAULT 0,
    sms_sent INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    
    -- Activity
    last_activity TIMESTAMP DEFAULT NOW(),
    peak_concurrent_users INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(license_id, month)
);

-- License Verification Logs
CREATE TABLE license_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
    verification_time TIMESTAMP DEFAULT NOW(),
    
    -- Verification Details
    status VARCHAR(20) NOT NULL, -- 'success', 'expired', 'suspended', 'invalid', 'hardware_mismatch'
    
    -- Request Info
    ip_address INET,
    user_agent TEXT,
    hardware_id VARCHAR(255),
    device_info JSONB,
    
    -- Geolocation (optional)
    country VARCHAR(2),
    city VARCHAR(100),
    
    -- Response
    response_code INTEGER,
    error_message TEXT
);

-- License Devices (Track multiple devices per license)
CREATE TABLE license_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
    
    -- Device Info
    device_name VARCHAR(255),
    hardware_id VARCHAR(255) UNIQUE NOT NULL,
    device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet', 'server'
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    
    -- Activity
    first_seen TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW(),
    activation_count INTEGER DEFAULT 1,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================================================
-- 2. MULTI-TENANT ORGANIZATION TABLES
-- =====================================================

-- Licensed Organizations (Tenant Level)
CREATE TABLE licensed_orgs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id UUID REFERENCES licenses(id) ON DELETE RESTRICT UNIQUE,
    
    -- Organization Info
    org_name VARCHAR(255) NOT NULL,
    org_slug VARCHAR(100) UNIQUE NOT NULL,
    org_description TEXT,
    
    -- Primary Contact
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255) NOT NULL,
    primary_contact_mobile VARCHAR(20) NOT NULL,
    
    -- SMS Provider Configuration
    sms_provider VARCHAR(50) DEFAULT 'twilio' CHECK (sms_provider IN ('twilio', 'msg91', 'kaleyra', 'textlocal')),
    sms_config JSONB, -- Encrypted credentials
    sms_enabled BOOLEAN DEFAULT true,
    
    -- DLT Registration (India)
    dlt_registered BOOLEAN DEFAULT false,
    dlt_entity_id VARCHAR(100),
    dlt_sender_id VARCHAR(20),
    dlt_template_ids JSONB DEFAULT '{}'::jsonb,
    
    -- Branding
    custom_domain VARCHAR(255),
    primary_color VARCHAR(7) DEFAULT '#1e40af',
    secondary_color VARCHAR(7) DEFAULT '#3b82f6',
    accent_color VARCHAR(7) DEFAULT '#10b981',
    logo_url TEXT,
    favicon_url TEXT,
    custom_css TEXT,
    
    -- Business Details
    business_type VARCHAR(100),
    industry VARCHAR(100),
    country VARCHAR(2) DEFAULT 'HK',
    timezone VARCHAR(50) DEFAULT 'Asia/Hong_Kong',
    currency VARCHAR(3) DEFAULT 'HKD',
    
    -- Settings
    settings JSONB DEFAULT '{
        "voucher_approval_required": true,
        "otp_verification": true,
        "auto_serial_number": true,
        "email_notifications": true,
        "sms_notifications": true,
        "allow_cash_payments": true,
        "require_payee_verification": true
    }'::jsonb,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending_setup')),
    onboarding_completed BOOLEAN DEFAULT false,
    onboarding_step INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 3. USER MANAGEMENT (Created before companies due to FK references)
-- =====================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES licensed_orgs(id) ON DELETE CASCADE,
    company_id UUID, -- FK added later after companies table is created
    
    -- User Info
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    mobile VARCHAR(20) NOT NULL,
    
    -- Authentication
    password_hash VARCHAR(255) NOT NULL,
    mobile_verified BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    
    -- Role
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'org_admin', 'company_admin', 'approver', 'accounts', 'viewer')),
    permissions JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    
    -- Security
    last_login TIMESTAMP,
    last_login_ip INET,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    
    -- Preferences
    preferences JSONB DEFAULT '{
        "language": "en",
        "theme": "light",
        "notifications": true
    }'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID
);

-- =====================================================
-- 4. COMPANIES (Within Organizations)
-- =====================================================

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES licensed_orgs(id) ON DELETE CASCADE,
    
    -- Company Details
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    gst_number VARCHAR(15),
    pan_number VARCHAR(10),
    tan_number VARCHAR(10),
    
    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    country VARCHAR(2) DEFAULT 'HK',
    
    -- Contact
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    
    -- Banking Details (Optional)
    bank_name VARCHAR(255),
    bank_account_number VARCHAR(50),
    bank_ifsc VARCHAR(20),
    bank_branch VARCHAR(255),
    
    -- Logo & Branding
    logo_url TEXT,
    
    -- Settings
    fiscal_year_start INTEGER DEFAULT 4, -- April = 4
    voucher_prefix VARCHAR(10) DEFAULT 'VCH',
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- Add company_id FK to users now that companies table exists
ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id);

-- =====================================================
-- 5. PAYEES
-- =====================================================

CREATE TABLE payees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES licensed_orgs(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Payee Details
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    
    -- Address
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    
    -- Tax Details
    pan_number VARCHAR(10),
    gst_number VARCHAR(15),
    
    -- Banking Details
    bank_name VARCHAR(255),
    account_number VARCHAR(50),
    ifsc_code VARCHAR(20),
    account_holder_name VARCHAR(255),
    
    -- UPI Details
    upi_id VARCHAR(100),
    
    -- Category
    payee_type VARCHAR(50), -- 'vendor', 'employee', 'contractor', 'supplier', 'other'
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    
    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    UNIQUE(company_id, mobile)
);

-- =====================================================
-- 6. HEADS OF ACCOUNT
-- =====================================================

CREATE TABLE heads_of_account (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES licensed_orgs(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id),
    
    -- Account Details
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Category
    category VARCHAR(100), -- 'expense', 'income', 'asset', 'liability'
    parent_id UUID REFERENCES heads_of_account(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    UNIQUE(company_id, code)
);

-- =====================================================
-- 7. VOUCHERS (Core Payment System)
-- =====================================================

CREATE TABLE vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES licensed_orgs(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Voucher Identification
    voucher_number VARCHAR(50) UNIQUE NOT NULL,
    financial_year VARCHAR(10) NOT NULL,
    
    -- Payee
    payee_id UUID REFERENCES payees(id) ON DELETE RESTRICT,
    payee_name VARCHAR(255) NOT NULL, -- Denormalized for reports
    payee_mobile VARCHAR(20) NOT NULL,
    
    -- Payment Details
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    payment_mode VARCHAR(50) NOT NULL CHECK (payment_mode IN ('cash', 'upi', 'account_transfer', 'cheque', 'card')),
    
    -- Account Head
    head_of_account_id UUID REFERENCES heads_of_account(id),
    head_of_account_name VARCHAR(255),
    
    -- Payment Mode Specific Details
    upi_id VARCHAR(100),
    bank_account_number VARCHAR(50),
    cheque_number VARCHAR(50),
    cheque_date DATE,
    transaction_reference VARCHAR(100),
    
    -- Description
    description TEXT NOT NULL,
    remarks TEXT,
    
    -- Workflow Status
    status VARCHAR(50) DEFAULT 'pending_approval' CHECK (status IN (
        'draft',
        'pending_approval',
        'approved',
        'rejected',
        'completed',
        'cancelled'
    )),
    
    -- Approval Flow
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    rejected_by UUID REFERENCES users(id),
    completed_by UUID REFERENCES users(id),
    
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    rejection_reason TEXT,
    
    -- OTP Verification
    payee_otp_verified BOOLEAN DEFAULT false,
    payee_otp_verified_at TIMESTAMP,
    
    -- Digital Signature
    digital_signature VARCHAR(64),
    signature_timestamp TIMESTAMP,
    signature_verified BOOLEAN DEFAULT FALSE,
    last_verification_at TIMESTAMPTZ,
    
    -- Attachments
    attachments JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 8. VOUCHER AUDIT TRAIL
-- =====================================================

CREATE TABLE voucher_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE,
    
    -- Action Details
    action VARCHAR(50) NOT NULL, -- 'created', 'approved', 'rejected', 'completed', 'cancelled', 'modified'
    performed_by UUID REFERENCES users(id),
    performed_by_name VARCHAR(255),
    performed_by_role VARCHAR(50),
    
    -- Changes
    old_values JSONB,
    new_values JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    notes TEXT,
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 9. SMS TEMPLATES & LOGS
-- =====================================================

CREATE TABLE sms_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES licensed_orgs(id) ON DELETE CASCADE,
    
    -- Template Details
    template_name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50) NOT NULL, -- 'otp_registration', 'otp_approval', 'voucher_notification', 'payment_confirmation'
    template_content TEXT NOT NULL,
    
    -- DLT Details
    dlt_template_id VARCHAR(100) NOT NULL,
    dlt_approved BOOLEAN DEFAULT false,
    
    -- Provider
    provider VARCHAR(50) DEFAULT 'twilio',
    
    -- Variables
    variables JSONB DEFAULT '[]'::jsonb, -- ['otp', 'amount', 'voucher_number']
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending_approval')),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sms_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES licensed_orgs(id) ON DELETE CASCADE,
    license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
    
    -- Recipient
    mobile VARCHAR(20) NOT NULL,
    
    -- Message
    message TEXT NOT NULL,
    template_id UUID REFERENCES sms_templates(id),
    
    -- Provider Response
    provider VARCHAR(50),
    provider_message_id VARCHAR(255),
    status VARCHAR(50), -- 'queued', 'sent', 'delivered', 'failed', 'undelivered'
    delivery_status VARCHAR(50),
    
    -- Error
    error_code VARCHAR(50),
    error_message TEXT,
    
    -- Cost
    credits_used DECIMAL(10,4) DEFAULT 1.0,
    
    -- Context
    context_type VARCHAR(50), -- 'otp_verification', 'voucher_notification', 'approval_notification'
    context_id UUID, -- voucher_id or user_id
    
    -- Timestamps
    sent_at TIMESTAMP DEFAULT NOW(),
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP
);

-- =====================================================
-- 10. SESSIONS & OTP
-- =====================================================

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session Details
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    
    -- Device Info
    device_id VARCHAR(255),
    device_name VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    
    -- Expiry
    expires_at TIMESTAMP NOT NULL,
    refresh_expires_at TIMESTAMP,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    last_activity TIMESTAMP DEFAULT NOW()
);

CREATE TABLE otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Recipient
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    
    -- OTP Details
    otp_code VARCHAR(6) NOT NULL,
    otp_type VARCHAR(50) NOT NULL, -- 'registration', 'login', 'payee_approval', 'password_reset'
    
    -- Context
    context_id UUID, -- voucher_id or user_id
    org_id UUID REFERENCES licensed_orgs(id) ON DELETE CASCADE,
    
    -- Status
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    -- Expiry
    expires_at TIMESTAMP NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 11. REPORTS & ANALYTICS
-- =====================================================

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES licensed_orgs(id) ON DELETE CASCADE,
    
    -- Report Details
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(100) NOT NULL, -- 'voucher_summary', 'payment_analysis', 'user_activity', 'sms_usage'
    
    -- Parameters
    date_from DATE,
    date_to DATE,
    company_id UUID REFERENCES companies(id),
    filters JSONB DEFAULT '{}'::jsonb,
    
    -- Results
    results JSONB,
    summary JSONB,
    
    -- Generated By
    generated_by UUID REFERENCES users(id),
    
    -- Export
    export_url TEXT,
    export_format VARCHAR(20), -- 'pdf', 'excel', 'csv'
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- 12. NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES licensed_orgs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification Details
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- 'voucher_approval', 'voucher_completed', 'system', 'license_expiry'
    
    -- Context
    context_type VARCHAR(50),
    context_id UUID,
    action_url TEXT,
    
    -- Priority
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    
    -- Status
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    
    -- Timestamp
    created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Licenses
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_email ON licenses(licensee_email);
CREATE INDEX idx_licenses_expiry ON licenses(expiry_date);

-- Organizations
CREATE INDEX idx_orgs_slug ON licensed_orgs(org_slug);
CREATE INDEX idx_orgs_license ON licensed_orgs(license_id);

-- Companies
CREATE INDEX idx_companies_org ON companies(org_id);
CREATE INDEX idx_companies_status ON companies(status);

-- Users
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_mobile ON users(mobile);
CREATE INDEX idx_users_role ON users(role);

-- Vouchers
CREATE INDEX idx_vouchers_org ON vouchers(org_id);
CREATE INDEX idx_vouchers_company ON vouchers(company_id);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_number ON vouchers(voucher_number);
CREATE INDEX idx_vouchers_created_at ON vouchers(created_at DESC);
CREATE INDEX idx_vouchers_financial_year ON vouchers(financial_year);

-- Audit Log
CREATE INDEX idx_audit_voucher ON voucher_audit_log(voucher_id);
CREATE INDEX idx_audit_created ON voucher_audit_log(created_at DESC);

-- SMS Logs
CREATE INDEX idx_sms_org ON sms_logs(org_id);
CREATE INDEX idx_sms_mobile ON sms_logs(mobile);
CREATE INDEX idx_sms_sent_at ON sms_logs(sent_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user ON notifications(user_id, read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tenant-specific tables
ALTER TABLE licensed_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payees ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE heads_of_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Organizations - Users can only see their own org
CREATE POLICY org_isolation ON licensed_orgs
    USING (id = current_setting('app.current_org_id', true)::UUID);

-- Companies - Isolate by org
CREATE POLICY company_isolation ON companies
    USING (org_id = current_setting('app.current_org_id', true)::UUID);

-- Users - Isolate by org
CREATE POLICY user_isolation ON users
    USING (org_id = current_setting('app.current_org_id', true)::UUID);

-- Payees - Isolate by org
CREATE POLICY payee_isolation ON payees
    USING (org_id = current_setting('app.current_org_id', true)::UUID);

-- Vouchers - Isolate by org
CREATE POLICY voucher_isolation ON vouchers
    USING (org_id = current_setting('app.current_org_id', true)::UUID);

-- Heads of Account - Isolate by org
CREATE POLICY hoa_isolation ON heads_of_account
    USING (org_id = current_setting('app.current_org_id', true)::UUID);

-- Notifications - Users see only their notifications
CREATE POLICY notification_isolation ON notifications
    USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_licenses_updated_at BEFORE UPDATE ON licenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orgs_updated_at BEFORE UPDATE ON licensed_orgs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vouchers_updated_at BEFORE UPDATE ON vouchers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate voucher number
CREATE OR REPLACE FUNCTION generate_voucher_number()
RETURNS TRIGGER AS $$
DECLARE
    prefix VARCHAR(10);
    fy VARCHAR(10);
    counter INTEGER;
    new_number VARCHAR(50);
BEGIN
    -- Get company prefix
    SELECT voucher_prefix INTO prefix FROM companies WHERE id = NEW.company_id;
    
    -- Get financial year
    fy := NEW.financial_year;
    
    -- Get counter
    SELECT COALESCE(MAX(CAST(SUBSTRING(voucher_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
    INTO counter
    FROM vouchers
    WHERE company_id = NEW.company_id AND financial_year = fy;
    
    -- Generate number
    new_number := prefix || '-' || fy || '-' || LPAD(counter::TEXT, 5, '0');
    
    NEW.voucher_number := new_number;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_generate_voucher_number
BEFORE INSERT ON vouchers
FOR EACH ROW
WHEN (NEW.voucher_number IS NULL)
EXECUTE FUNCTION generate_voucher_number();

-- =====================================================
-- DEFAULT DATA
-- =====================================================

-- Default Heads of Account (Global)
INSERT INTO heads_of_account (id, code, name, description, category) VALUES
(uuid_generate_v4(), 'SAL', 'Salaries', 'Employee Salaries', 'expense'),
(uuid_generate_v4(), 'RENT', 'Rent', 'Office Rent', 'expense'),
(uuid_generate_v4(), 'UTIL', 'Utilities', 'Electricity, Water, Internet', 'expense'),
(uuid_generate_v4(), 'TRAV', 'Travel', 'Travel & Conveyance', 'expense'),
(uuid_generate_v4(), 'SUPP', 'Supplies', 'Office Supplies', 'expense'),
(uuid_generate_v4(), 'MAIN', 'Maintenance', 'Repairs & Maintenance', 'expense'),
(uuid_generate_v4(), 'ADV', 'Advertising', 'Marketing & Advertising', 'expense'),
(uuid_generate_v4(), 'PROF', 'Professional Fees', 'Consultant & Professional Services', 'expense'),
(uuid_generate_v4(), 'INS', 'Insurance', 'Insurance Premiums', 'expense'),
(uuid_generate_v4(), 'MISC', 'Miscellaneous', 'Other Expenses', 'expense');

-- =====================================================
-- VIEWS FOR REPORTING
-- =====================================================

-- Voucher Summary View
CREATE OR REPLACE VIEW voucher_summary AS
SELECT 
    v.org_id,
    v.company_id,
    c.name as company_name,
    DATE_TRUNC('month', v.created_at) as month,
    v.status,
    COUNT(*) as voucher_count,
    SUM(v.amount) as total_amount,
    AVG(v.amount) as avg_amount
FROM vouchers v
JOIN companies c ON v.company_id = c.id
GROUP BY v.org_id, v.company_id, c.name, DATE_TRUNC('month', v.created_at), v.status;

-- License Usage Summary View
CREATE OR REPLACE VIEW license_usage_summary AS
SELECT 
    l.id as license_id,
    l.license_key,
    l.licensee_name,
    l.status,
    lu.month,
    lu.companies_count,
    lu.users_count,
    lu.vouchers_count,
    lu.sms_sent,
    l.max_companies,
    l.max_users,
    l.max_vouchers_per_month,
    l.sms_credits,
    CASE 
        WHEN lu.companies_count >= l.max_companies THEN 'limit_reached'
        WHEN lu.companies_count >= l.max_companies * 0.8 THEN 'warning'
        ELSE 'ok'
    END as companies_status,
    CASE 
        WHEN lu.users_count >= l.max_users THEN 'limit_reached'
        WHEN lu.users_count >= l.max_users * 0.8 THEN 'warning'
        ELSE 'ok'
    END as users_status,
    CASE 
        WHEN lu.vouchers_count >= l.max_vouchers_per_month THEN 'limit_reached'
        WHEN lu.vouchers_count >= l.max_vouchers_per_month * 0.8 THEN 'warning'
        ELSE 'ok'
    END as vouchers_status
FROM licenses l
LEFT JOIN license_usage lu ON l.id = lu.license_id AND lu.month = TO_CHAR(NOW(), 'YYYY-MM');

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE licenses IS 'Software licenses for white-label system';
COMMENT ON TABLE licensed_orgs IS 'Tenant organizations - each license gets one org';
COMMENT ON TABLE companies IS 'Companies within organizations - multi-company support';
COMMENT ON TABLE vouchers IS 'Payment vouchers - core business logic';
COMMENT ON TABLE voucher_audit_log IS 'Immutable audit trail for all voucher actions';

-- =====================================================
-- SCHEMA VERSION TRACKING
-- =====================================================

CREATE TABLE schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
('2.0.0', 'White-Label Multi-Tenant Schema - Complete System');

-- END OF SCHEMA

-- =====================================================
-- SIGNATURE VERIFICATION AUDIT TRAIL
-- =====================================================

-- Signature Verifications Table
CREATE TABLE signature_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_by UUID REFERENCES users(id),
    
    -- Verification Results
    verification_result VARCHAR(20) NOT NULL CHECK (verification_result IN ('VALID', 'INVALID', 'EXPIRED')),
    signature_checked VARCHAR(64) NOT NULL,
    expected_signature VARCHAR(64),
    
    -- Request Context
    ip_address INET,
    user_agent TEXT,
    request_source VARCHAR(50), -- 'web', 'api', 'mobile', 'qr_scan'
    
    -- Metadata
    verification_duration_ms INTEGER,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_signature_verifications_voucher ON signature_verifications(voucher_id);
CREATE INDEX idx_signature_verifications_verified_at ON signature_verifications(verified_at DESC);
CREATE INDEX idx_signature_verifications_result ON signature_verifications(verification_result);

-- Signature fields are now included in the vouchers table definition above

-- Add signing secret to licensed_orgs (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'licensed_orgs' AND column_name = 'org_signing_secret'
    ) THEN
        ALTER TABLE licensed_orgs 
        ADD COLUMN org_signing_secret TEXT, -- AES-256 encrypted
        ADD COLUMN secret_rotated_at TIMESTAMPTZ;
    END IF;
END $$;

-- =====================================================
-- SIGNATURE VERIFICATION FUNCTIONS
-- =====================================================

-- Function to update signature verification status on voucher
CREATE OR REPLACE FUNCTION update_voucher_verification_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE vouchers
    SET 
        signature_verified = (NEW.verification_result = 'VALID'),
        last_verification_at = NEW.verified_at
    WHERE id = NEW.voucher_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update voucher verification status
DROP TRIGGER IF EXISTS trg_update_voucher_verification ON signature_verifications;
CREATE TRIGGER trg_update_voucher_verification
    AFTER INSERT ON signature_verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_voucher_verification_status();

-- Function to get organization's voucher IDs (for batch operations)
CREATE OR REPLACE FUNCTION get_org_vouchers(p_org_id UUID)
RETURNS TABLE(voucher_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT id FROM vouchers WHERE org_id = p_org_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS FOR SIGNATURE MONITORING
-- =====================================================

-- View: Recent Signature Verifications (Last 7 days)
CREATE OR REPLACE VIEW vw_recent_signature_verifications AS
SELECT 
    sv.id,
    sv.voucher_id,
    v.voucher_number,
    v.amount,
    c.name as company_name,
    lo.org_name as organization_name,
    u.full_name as verified_by_name,
    sv.verification_result,
    sv.verified_at,
    sv.ip_address,
    sv.request_source
FROM signature_verifications sv
JOIN vouchers v ON sv.voucher_id = v.id
LEFT JOIN companies c ON v.company_id = c.id
LEFT JOIN licensed_orgs lo ON v.org_id = lo.id
LEFT JOIN users u ON sv.verified_by = u.id
WHERE sv.verified_at >= NOW() - INTERVAL '7 days'
ORDER BY sv.verified_at DESC;

-- View: Signature Verification Summary by Organization
CREATE OR REPLACE VIEW vw_org_signature_stats AS
SELECT 
    lo.id as org_id,
    lo.org_name as organization_name,
    COUNT(DISTINCT sv.id) as total_verifications,
    COUNT(DISTINCT CASE WHEN sv.verification_result = 'VALID' THEN sv.id END) as valid_count,
    COUNT(DISTINCT CASE WHEN sv.verification_result = 'INVALID' THEN sv.id END) as invalid_count,
    COUNT(DISTINCT sv.voucher_id) as vouchers_verified,
    MAX(sv.verified_at) as last_verification_at,
    COUNT(DISTINCT CASE 
        WHEN sv.verified_at >= NOW() - INTERVAL '24 hours' 
        THEN sv.id 
    END) as verifications_last_24h
FROM licensed_orgs lo
LEFT JOIN vouchers v ON v.org_id = lo.id
LEFT JOIN signature_verifications sv ON sv.voucher_id = v.id
GROUP BY lo.id, lo.org_name;

-- View: Suspicious Signature Activity (Multiple Invalid Verifications)
CREATE OR REPLACE VIEW vw_suspicious_signature_activity AS
SELECT 
    v.id as voucher_id,
    v.voucher_number,
    c.name as company_name,
    COUNT(CASE WHEN sv.verification_result = 'INVALID' THEN 1 END) as invalid_attempts,
    COUNT(*) as total_verifications,
    MAX(sv.verified_at) as last_attempt,
    ARRAY_AGG(DISTINCT sv.ip_address) as ip_addresses
FROM vouchers v
JOIN companies c ON v.company_id = c.id
JOIN signature_verifications sv ON sv.voucher_id = v.id
WHERE sv.verified_at >= NOW() - INTERVAL '7 days'
GROUP BY v.id, v.voucher_number, c.name
HAVING COUNT(CASE WHEN sv.verification_result = 'INVALID' THEN 1 END) >= 3
ORDER BY invalid_attempts DESC;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) FOR SIGNATURE VERIFICATIONS
-- =====================================================

-- Enable RLS on signature_verifications
ALTER TABLE signature_verifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view verifications for their organization
CREATE POLICY signature_verifications_select_policy ON signature_verifications
    FOR SELECT
    USING (
        voucher_id IN (
            SELECT id FROM vouchers 
            WHERE org_id = current_setting('app.current_org_id', TRUE)::UUID
        )
    );

-- Policy: Authenticated users can insert verification logs
CREATE POLICY signature_verifications_insert_policy ON signature_verifications
    FOR INSERT
    WITH CHECK (
        verified_by = current_setting('app.current_user_id', TRUE)::UUID
    );

-- =====================================================
-- SAMPLE DATA: Initialize Organization Signing Secrets
-- =====================================================
-- Note: This should be run after organizations are created
-- The secrets should be generated securely and encrypted

COMMENT ON TABLE signature_verifications IS 'Audit trail for all voucher signature verification attempts';
COMMENT ON COLUMN signature_verifications.signature_checked IS 'The digital signature that was checked (64 hex chars)';
COMMENT ON COLUMN signature_verifications.verification_result IS 'Result: VALID, INVALID, or EXPIRED';
COMMENT ON COLUMN signature_verifications.request_source IS 'Source of verification request: web, api, mobile, or qr_scan';

COMMENT ON TABLE vouchers IS 'Main vouchers table with digital signatures for integrity';
COMMENT ON COLUMN vouchers.digital_signature IS 'HMAC-SHA256 signature (64 hex chars) for voucher integrity';
COMMENT ON COLUMN vouchers.signature_timestamp IS 'Timestamp when the voucher was signed';
COMMENT ON COLUMN vouchers.signature_verified IS 'Cached status: true if last verification was successful';
COMMENT ON COLUMN vouchers.last_verification_at IS 'Timestamp of last signature verification';

COMMENT ON COLUMN licensed_orgs.org_signing_secret IS 'AES-256 encrypted secret for HMAC-SHA256 voucher signing';
COMMENT ON COLUMN licensed_orgs.secret_rotated_at IS 'Timestamp of last secret rotation';

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index on vouchers for signature lookups
CREATE INDEX IF NOT EXISTS idx_vouchers_digital_signature ON vouchers(digital_signature);
CREATE INDEX IF NOT EXISTS idx_vouchers_signature_verified ON vouchers(signature_verified);

-- =====================================================
-- AUDIT LOGGING
-- =====================================================

-- Log secret rotation events
CREATE TABLE IF NOT EXISTS secret_rotation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES licensed_orgs(id) ON DELETE CASCADE,
    rotated_at TIMESTAMPTZ DEFAULT NOW(),
    rotated_by UUID REFERENCES users(id),
    vouchers_resigned INTEGER,
    reason TEXT,
    status VARCHAR(20) CHECK (status IN ('success', 'partial', 'failed'))
);

CREATE INDEX idx_secret_rotation_logs_org ON secret_rotation_logs(org_id);
CREATE INDEX idx_secret_rotation_logs_date ON secret_rotation_logs(rotated_at DESC);

COMMENT ON TABLE secret_rotation_logs IS 'Audit log for organization signing secret rotation events';

