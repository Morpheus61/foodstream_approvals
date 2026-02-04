# 🚀 FoodStream Ltd. White-Label Payment Approval SAAS System

## Complete Multi-Tenant Payment Voucher System with Licensing

**Version:** 2.0.0  
**Author:** FoodStream Ltd.  
**License:** MIT

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [System Architecture](#system-architecture)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Database Setup](#database-setup)
7. [License Management](#license-management)
8. [API Documentation](#api-documentation)
9. [Deployment](#deployment)
10. [Security](#security)
11. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

This is a complete **White-Label SAAS** solution for managing payment approvals with:

- **Multi-Tenancy**: Each licensed organization gets their own isolated environment
- **License Management**: Software licensing system with usage tracking
- **White-Label Branding**: Full customization (logo, colors, domain)
- **SMS Integration**: Multi-provider SMS with DLT compliance (India)
- **Payment Workflow**: Voucher creation → Approval → OTP Verification → Complete
- **PWA Ready**: Install as native app on mobile/desktop

---

## ✨ Features

### 🔐 Licensing System
- **License Types**: Trial, Basic, Premium, Enterprise
- **Hardware Locking**: Prevent license sharing
- **Usage Tracking**: Monitor companies, users, vouchers, SMS
- **Auto-Expiry**: Automatic license expiration handling
- **Offline Grace Period**: 7-day offline operation

### 🏢 Multi-Tenant Architecture
- **Organization Isolation**: Complete data separation
- **Multiple Companies**: Each org can manage multiple companies
- **Role-Based Access**: Super Admin, Org Admin, Approver, Accounts
- **Row-Level Security**: Database-level tenant isolation

### 📱 SMS & OTP
- **Multi-Provider**: Twilio, MSG91, Kaleyra, TextLocal
- **DLT Compliance**: Full support for Indian DLT regulations
- **Template Management**: Custom SMS templates per organization
- **OTP Verification**: Secure 2FA for critical actions

### 💰 Voucher Workflow
1. Accounts staff creates voucher
2. Admin/Approver reviews and approves
3. OTP sent to payee's mobile
4. Accounts staff enters OTP from payee
5. Voucher marked complete, payment can proceed

### 🎨 White-Label Customization
- Custom logo and favicon
- Brand colors (primary, secondary, accent)
- Custom domain support
- Organization-specific branding on vouchers

### 📊 Reporting & Analytics
- Voucher summary reports
- Payment analysis
- License usage reports
- SMS usage tracking
- Audit trail for compliance

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (PWA)                        │
│  React 18 • Responsive UI • Offline Support • Push Notify  │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/JWT
┌──────────────────────┴──────────────────────────────────────┐
│                     Express.js Backend                       │
│  License Check • Auth • Rate Limiting • Session Management  │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────┴────────┐ ┌──┴─────────┐ ┌─┴────────────┐
│   Supabase     │ │   Twilio   │ │   File       │
│  (PostgreSQL)  │ │  / MSG91   │ │   Storage    │
│                │ │   (SMS)    │ │              │
└────────────────┘ └────────────┘ └──────────────┘
```

### Tech Stack

**Backend:**
- Node.js 18+
- Express.js 4.x
- Supabase (PostgreSQL with Row-Level Security)
- JWT for authentication
- Winston for logging
- Helmet for security

**Frontend:**
- React 18 (via CDN)
- Tailwind CSS
- Progressive Web App (PWA)
- Service Worker for offline support

**SMS Providers:**
- Twilio
- MSG91
- Kaleyra
- TextLocal

---

## 💻 Installation

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Supabase account
- SMS provider account (Twilio/MSG91)

### Steps

```bash
# 1. Clone or extract the project
cd foodstream-whitelabel-saas

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env

# 4. Edit .env with your credentials
nano .env  # or your preferred editor

# 5. Setup database (see Database Setup section)

# 6. Start development server
npm run dev

# Or start production server
npm start
```

### Development vs Production

**Development:**
```bash
npm run dev  # Uses nodemon for auto-reload
```

**Production:**
```bash
NODE_ENV=production npm start
```

---

## ⚙️ Configuration

### Environment Variables

Create `.env` file from `.env.example`:

```bash
# Required Variables
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...
JWT_SECRET=generate-32-byte-random-hex
ENCRYPTION_KEY=generate-32-byte-random-hex
LICENSE_SECRET=generate-random-string

# SMS Provider (Choose one)
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...
TWILIO_VERIFY_SERVICE_SID=VAxxx...

# OR

MSG91_AUTH_KEY=xxx...
MSG91_SENDER_ID=RLSHFD
```

### Generate Secrets

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate LICENSE_SECRET
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

---

## 🗄️ Database Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Note your Project URL and Service Key

### Step 2: Run SQL Schema

1. Open Supabase SQL Editor
2. Copy content from `database/schema.sql`
3. Execute the entire script

This will create:
- ✅ All tables (licenses, organizations, companies, users, vouchers, etc.)
- ✅ Indexes for performance
- ✅ Row-Level Security policies
- ✅ Triggers for auto-updates
- ✅ Views for reporting

### Step 3: Verify Installation

```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';

-- Should show: licenses, licensed_orgs, companies, users, vouchers, etc.
```

---

## 🔑 License Management

### License Types

| Type | Price | Companies | Users | Vouchers/Month | SMS Credits |
|------|-------|-----------|-------|----------------|-------------|
| **Trial** | Free | 1 | 3 | 50 | 100 |
| **Basic** | HK$720/mo | 3 | 10 | 500 | 1,000 |
| **Premium** | HK$1,920/mo | 10 | 50 | 2,000 | 5,000 |
| **Enterprise** | Custom | Unlimited | Unlimited | Unlimited | Unlimited |

### Generate License

```javascript
// Using Node.js
const LicenseGenerator = require('./server/utils/licenseGenerator');

const license = LicenseGenerator.generateTrialLicense(
    'user@example.com',
    'Company Name',
    '+919876543210'
);

console.log('License Key:', license.licenseKey);
// Output: TRL-4XY9Z-8K2L4-M7N3P-C4F6
```

### License Key Format

```
[TYPE]-[TIME]-[RAND1]-[RAND2]-[CHECK]
  │      │      │       │       │
  │      │      │       │       └─ Checksum (4 chars)
  │      │      │       └───────── Random part 2 (4 chars)
  │      │      └───────────────── Random part 1 (5 chars)
  │      └──────────────────────── Timestamp (5 chars, base36)
  └─────────────────────────────── Type prefix (3 chars)
                                   TRL=Trial, BSC=Basic,
                                   PRM=Premium, ENT=Enterprise
```

### Activate License

**API Endpoint:**
```http
POST /api/onboarding/activate-license
Content-Type: application/json

{
  "licenseKey": "PRM-4XY9Z-8K2L4-M7N3P-C4F6",
  "primaryContactEmail": "admin@company.com",
  "primaryContactMobile": "+919876543210"
}
```

**Response:**
```json
{
  "success": true,
  "licenseId": "uuid-here",
  "message": "License activated successfully"
}
```

---

## 📡 API Documentation

### Base URL

```
Development: http://localhost:3001/api
Production: https://your-domain.com/api
```

### Authentication

All protected endpoints require JWT token in header:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

Or license key:

```http
X-License-Key: YOUR_LICENSE_KEY
```

### API Endpoints

#### Authentication

**POST /api/auth/register**
```json
{
  "username": "john_accounts",
  "fullName": "John Doe",
  "email": "john@company.com",
  "mobile": "+919876543210",
  "password": "SecurePass123!",
  "orgId": "uuid",
  "role": "accounts"
}
```

**POST /api/auth/login**
```json
{
  "username": "john_accounts",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "username": "john_accounts",
    "fullName": "John Doe",
    "role": "accounts",
    "orgId": "uuid"
  }
}
```

#### OTP Management

**POST /api/auth/otp/send**
```json
{
  "mobile": "+919876543210",
  "otpType": "registration",
  "orgId": "uuid"
}
```

**POST /api/auth/otp/verify**
```json
{
  "mobile": "+919876543210",
  "otp": "123456"
}
```

#### Onboarding

**POST /api/onboarding/activate-license**
- Activates a new license
- Ties to hardware ID
- Creates initial organization

**POST /api/onboarding/setup-org**
- Configures organization details
- Sets branding (logo, colors)
- Requires active license

**POST /api/onboarding/setup-sms**
- Configures SMS provider
- Stores encrypted credentials
- Registers DLT templates

#### Companies

**GET /api/companies**
- List all companies in organization

**POST /api/companies**
- Create new company
- Requires org admin role

**GET /api/companies/:id**
- Get company details

**PUT /api/companies/:id**
- Update company

**DELETE /api/companies/:id**
- Deactivate company

#### Vouchers

**POST /api/vouchers**
```json
{
  "companyId": "uuid",
  "payeeId": "uuid",
  "amount": 5000.00,
  "paymentMode": "upi",
  "headOfAccountId": "uuid",
  "description": "Office supplies payment",
  "upiId": "payee@upi"
}
```

**GET /api/vouchers?companyId=uuid&status=pending_approval**
- List vouchers with filters

**POST /api/vouchers/:id/approve**
- Approve voucher (Admin only)
- Sends OTP to payee

**POST /api/vouchers/:id/complete**
```json
{
  "otp": "123456"
}
```

**POST /api/vouchers/:id/reject**
```json
{
  "reason": "Insufficient documentation"
}
```

#### Reports

**GET /api/reports/voucher-summary**
```http
?companyId=uuid&dateFrom=2024-01-01&dateTo=2024-12-31
```

**GET /api/reports/license-usage**
- Current month usage
- License limits
- Warning indicators

### Response Format

**Success:**
```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation successful"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `LICENSE_MISSING` | License key not provided | 401 |
| `LICENSE_EXPIRED` | License has expired | 403 |
| `LICENSE_LIMIT_VOUCHERS` | Monthly voucher limit reached | 429 |
| `AUTH_REQUIRED` | Authentication required | 401 |
| `INSUFFICIENT_PERMISSIONS` | User lacks required role | 403 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `OTP_INVALID` | OTP verification failed | 400 |

---

## 🚀 Deployment

### Vercel Deployment

1. **Push to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_REPO_URL
git push -u origin main
```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your repository
   - Configure build settings

3. **Set Environment Variables:**
   - Add all variables from `.env`
   - Set `NODE_ENV=production`

4. **Deploy!**

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

```bash
docker build -t foodstream-saas .
docker run -p 3001:3001 --env-file .env foodstream-saas
```

### Environment-Specific Settings

**Production Checklist:**
- ✅ Set `NODE_ENV=production`
- ✅ Use strong secrets (32+ characters)
- ✅ Enable HTTPS only
- ✅ Configure CORS properly
- ✅ Set up database backups
- ✅ Enable monitoring (Sentry)
- ✅ Configure CDN for static assets

---

## 🔒 Security

### Security Features

1. **Encryption:**
   - AES-256-CBC for sensitive data
   - bcrypt for passwords (10 rounds)
   - JWT for session tokens

2. **Rate Limiting:**
   - API: 100 req/15min
   - Auth: 5 attempts/15min
   - OTP: 3 req/10min

3. **Middleware:**
   - Helmet for security headers
   - CORS with whitelist
   - XSS protection
   - SQL injection prevention (parameterized queries)

4. **Audit Trail:**
   - All voucher actions logged
   - Immutable logs
   - User activity tracking
   - License verification logs

5. **Row-Level Security:**
   - Database-level tenant isolation
   - No cross-organization data access
   - Automatic data filtering

### Best Practices

```javascript
// ✅ DO: Use parameterized queries
const { data } = await supabase
    .from('vouchers')
    .select('*')
    .eq('id', voucherId);

// ❌ DON'T: String concatenation
const query = `SELECT * FROM vouchers WHERE id = '${voucherId}'`;
```

---

## 🐛 Troubleshooting

### Common Issues

**1. License Verification Fails**

```
Error: LICENSE_HARDWARE_MISMATCH
```

**Solution:**
- Hardware ID changed (new device/OS)
- Contact support to reset hardware binding
- Or disable hardware lock in `.env`:
```bash
ENABLE_HARDWARE_LOCK=false
```

**2. SMS Not Sending**

**Check:**
- SMS provider credentials correct
- DLT templates registered (India)
- Organization has SMS enabled
- Sufficient SMS credits

**3. Database Connection Error**

```
Error: Supabase configuration missing
```

**Solution:**
```bash
# Verify .env has correct values
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...
```

**4. OTP Verification Fails**

**Reasons:**
- OTP expired (10 min limit)
- Wrong OTP entered
- Max attempts exceeded (3)

**Fix:**
- Request new OTP
- Check SMS delivery status
- Verify mobile number format (+91...)

### Logs

**View Logs:**
```bash
# Error logs
tail -f logs/error.log

# All logs
tail -f logs/combined.log

# License verifications
tail -f logs/combined.log | grep LICENSE
```

### Database Queries

**Check License Status:**
```sql
SELECT 
    license_key,
    license_type,
    status,
    expiry_date,
    last_verified
FROM licenses
WHERE licensee_email = 'your@email.com';
```

**Check Usage:**
```sql
SELECT * FROM license_usage_summary
WHERE license_key = 'YOUR-LICENSE-KEY';
```

---

## 📞 Support

**Documentation:** `/docs/API.md`  
**GitHub Issues:** [Create Issue](https://github.com/your-repo/issues)  
**Email:** support@foodstream-saas.com

---

## 📝 License

MIT License - See LICENSE file for details

---

## 🙏 Credits

Built with ❤️ by **FoodStream Ltd.**

Technologies:
- Express.js
- Supabase
- Twilio/MSG91
- React
- Tailwind CSS

---

## 🔄 Changelog

### Version 2.0.0 (Current)
- ✨ White-label multi-tenant architecture
- ✨ Complete licensing system
- ✨ SMS multi-provider support
- ✨ DLT compliance for India
- ✨ Enhanced security features
- ✨ Admin dashboard
- ✨ Comprehensive API documentation

### Version 1.0.0
- Initial release
- Basic voucher workflow
- Single-tenant architecture

---

**Happy Building! 🚀**
