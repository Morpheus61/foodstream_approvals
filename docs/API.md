# 📡 API Documentation - Payment Approval SAAS

**Version:** 2.0.0  
**Base URL:** `https://your-domain.com/api`  
**Authentication:** JWT Bearer Token or License Key

---

## 📑 Table of Contents

1. [Authentication](#authentication)
2. [License Management](#license-management)
3. [Onboarding](#onboarding)
4. [Organizations](#organizations)
5. [Companies](#companies)
6. [Users](#users)
7. [Payees](#payees)
8. [Vouchers](#vouchers)
9. [Reports](#reports)
10. [Notifications](#notifications)
11. [Error Codes](#error-codes)

---

## 🔐 Authentication

### POST /api/auth/register

Register a new user.

**Request:**
```json
{
  "username": "john_accounts",
  "fullName": "John Doe",
  "email": "john@company.com",
  "mobile": "+919876543210",
  "password": "SecurePass123!",
  "orgId": "uuid-of-organization",
  "role": "accounts"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "john_accounts"
  }
}
```

**Roles:**
- `super_admin` - System administrator
- `org_admin` - Organization administrator
- `company_admin` - Company administrator
- `approver` - Can approve/reject vouchers
- `accounts` - Can create vouchers
- `viewer` - Read-only access

---

### POST /api/auth/login

User login.

**Request:**
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
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "username": "john_accounts",
    "fullName": "John Doe",
    "role": "accounts",
    "orgId": "uuid",
    "org": {
      "id": "uuid",
      "org_name": "Company Name",
      "org_slug": "company-slug"
    }
  }
}
```

**Token Usage:**
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### POST /api/auth/otp/send

Send OTP to mobile number.

**Request:**
```json
{
  "mobile": "+919876543210",
  "otpType": "registration",
  "orgId": "uuid"
}
```

**OTP Types:**
- `registration` - User registration
- `login` - Two-factor login
- `payee_approval` - Voucher approval
- `password_reset` - Password reset

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

**Rate Limit:** 3 requests per 10 minutes per mobile number

---

### POST /api/auth/otp/verify

Verify OTP.

**Request:**
```json
{
  "mobile": "+919876543210",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Invalid or expired OTP"
}
```

---

## 🔑 License Management

### POST /api/licenses/validate

Validate license key.

**Request:**
```http
POST /api/licenses/validate
X-License-Key: PRM-4XY9Z-8K2L4-M7N3P-C4F6
```

**Response:**
```json
{
  "success": true,
  "license": {
    "licenseKey": "PRM-4XY9Z-8K2L4-M7N3P-C4F6",
    "licenseType": "premium",
    "status": "active",
    "expiryDate": "2025-12-31T23:59:59.000Z",
    "maxCompanies": 10,
    "maxUsers": 50,
    "maxVouchersPerMonth": 2000,
    "smsCredits": 5000,
    "features": {
      "print": true,
      "reports": true,
      "api_access": true
    }
  },
  "usage": {
    "companiesCount": 3,
    "usersCount": 12,
    "vouchersCount": 245,
    "smsUsed": 567
  }
}
```

---

### GET /api/licenses/usage

Get current month usage.

**Headers:**
```http
Authorization: Bearer {token}
X-License-Key: {license-key}
```

**Response:**
```json
{
  "success": true,
  "month": "2024-01",
  "usage": {
    "companies": {
      "used": 3,
      "limit": 10,
      "percentage": 30,
      "status": "ok"
    },
    "users": {
      "used": 12,
      "limit": 50,
      "percentage": 24,
      "status": "ok"
    },
    "vouchers": {
      "used": 245,
      "limit": 2000,
      "percentage": 12.25,
      "status": "ok"
    },
    "sms": {
      "used": 567,
      "limit": 5000,
      "percentage": 11.34,
      "status": "ok"
    }
  },
  "warnings": []
}
```

**Status Values:**
- `ok` - Under 80% usage
- `warning` - 80-99% usage
- `limit_reached` - 100% usage

---

## 🚀 Onboarding

### POST /api/onboarding/activate-license

Activate a new license.

**Request:**
```json
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
  "licenseId": "uuid",
  "message": "License activated successfully"
}
```

**Note:** This endpoint ties the license to the device hardware ID.

---

### POST /api/onboarding/setup-org

Setup organization details after license activation.

**Headers:**
```http
X-License-Key: PRM-4XY9Z-8K2L4-M7N3P-C4F6
```

**Request:**
```json
{
  "orgName": "ABC Corporation",
  "orgSlug": "abc-corp",
  "primaryColor": "#1e40af",
  "secondaryColor": "#3b82f6",
  "logoUrl": "https://cdn.example.com/logo.png",
  "faviconUrl": "https://cdn.example.com/favicon.ico"
}
```

**Response:**
```json
{
  "success": true,
  "org": {
    "id": "uuid",
    "org_name": "ABC Corporation",
    "org_slug": "abc-corp",
    "status": "active"
  }
}
```

---

### POST /api/onboarding/setup-sms

Configure SMS provider.

**Headers:**
```http
X-License-Key: {license-key}
```

**Request:**
```json
{
  "provider": "msg91",
  "credentials": {
    "authKey": "your-msg91-auth-key",
    "senderId": "ABCCOR"
  },
  "dltEntityId": "1107170000000123456",
  "dltTemplates": [
    {
      "type": "otp_registration",
      "templateId": "1107170000000123456",
      "content": "{#var#} is your OTP for registration at {#var#}. Valid for 10 minutes. - {#var#}"
    },
    {
      "type": "otp_approval",
      "templateId": "1107170000000123457",
      "content": "Payment voucher {#var#} for Rs.{#var#} approved. OTP: {#var#}. Valid 10 min. - {#var#}"
    }
  ]
}
```

**Providers:**
- `twilio` - Twilio
- `msg91` - MSG91
- `kaleyra` - Kaleyra
- `textlocal` - TextLocal

**Response:**
```json
{
  "success": true,
  "message": "SMS provider configured successfully"
}
```

---

## 🏢 Companies

### GET /api/companies

List all companies in organization.

**Headers:**
```http
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "companies": [
    {
      "id": "uuid",
      "name": "Relish Foods Pvt Ltd",
      "gst_number": "33AAACR7749E2ZD",
      "city": "Kanyakumari",
      "state": "Tamil Nadu",
      "status": "active",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "total": 1
}
```

---

### POST /api/companies

Create new company.

**Headers:**
```http
Authorization: Bearer {token}
```

**Request:**
```json
{
  "name": "Relish Foods Pvt Ltd",
  "legalName": "Relish Foods Private Limited",
  "gstNumber": "33AAACR7749E2ZD",
  "panNumber": "AAACR7749E",
  "addressLine1": "123 Main Street",
  "city": "Kanyakumari",
  "state": "Tamil Nadu",
  "pincode": "629001",
  "country": "IN",
  "phone": "+914651234567",
  "email": "info@relishfoods.com",
  "logoUrl": "https://cdn.example.com/relish-logo.png"
}
```

**Response:**
```json
{
  "success": true,
  "company": {
    "id": "uuid",
    "name": "Relish Foods Pvt Ltd",
    "gst_number": "33AAACR7749E2ZD"
  }
}
```

---

## 💰 Vouchers

### POST /api/vouchers

Create payment voucher.

**Headers:**
```http
Authorization: Bearer {token}
```

**Request:**
```json
{
  "companyId": "uuid",
  "payeeId": "uuid",
  "amount": 5000.00,
  "paymentMode": "upi",
  "headOfAccountId": "uuid",
  "description": "Office supplies payment",
  "upiId": "payee@upi",
  "remarks": "Invoice #12345"
}
```

**Payment Modes:**
- `cash` - Cash payment
- `upi` - UPI transfer
- `account_transfer` - Bank account transfer
- `cheque` - Cheque payment
- `card` - Card payment

**Response:**
```json
{
  "success": true,
  "voucher": {
    "id": "uuid",
    "voucher_number": "VCH-2024-25-00001",
    "amount": 5000.00,
    "status": "pending_approval",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### GET /api/vouchers

List vouchers with filters.

**Query Parameters:**
```http
?companyId=uuid
&status=pending_approval
&dateFrom=2024-01-01
&dateTo=2024-12-31
&page=1
&limit=20
```

**Response:**
```json
{
  "success": true,
  "vouchers": [
    {
      "id": "uuid",
      "voucher_number": "VCH-2024-25-00001",
      "payee_name": "John Supplier",
      "amount": 5000.00,
      "payment_mode": "upi",
      "status": "pending_approval",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

### POST /api/vouchers/:id/approve

Approve voucher (Admin/Approver only).

**Headers:**
```http
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Voucher approved. OTP sent to payee.",
  "voucher": {
    "id": "uuid",
    "status": "approved",
    "approved_at": "2024-01-15T11:00:00.000Z",
    "approved_by": "uuid"
  }
}
```

**Note:** This sends OTP to payee's mobile number.

---

### POST /api/vouchers/:id/complete

Complete voucher with payee OTP.

**Headers:**
```http
Authorization: Bearer {token}
```

**Request:**
```json
{
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Voucher completed successfully",
  "voucher": {
    "id": "uuid",
    "status": "completed",
    "completed_at": "2024-01-15T11:05:00.000Z",
    "digital_signature": "a1b2c3d4..."
  }
}
```

---

### POST /api/vouchers/:id/reject

Reject voucher.

**Headers:**
```http
Authorization: Bearer {token}
```

**Request:**
```json
{
  "reason": "Insufficient documentation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Voucher rejected",
  "voucher": {
    "id": "uuid",
    "status": "rejected",
    "rejected_at": "2024-01-15T11:00:00.000Z",
    "rejection_reason": "Insufficient documentation"
  }
}
```

---

## 📊 Reports

### GET /api/reports/voucher-summary

Get voucher summary report.

**Query Parameters:**
```http
?companyId=uuid
&dateFrom=2024-01-01
&dateTo=2024-12-31
&groupBy=status
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "total_vouchers": 245,
    "total_amount": 1250000.00,
    "by_status": {
      "pending_approval": { "count": 12, "amount": 45000.00 },
      "approved": { "count": 8, "amount": 32000.00 },
      "completed": { "count": 220, "amount": 1168000.00 },
      "rejected": { "count": 5, "amount": 5000.00 }
    },
    "by_payment_mode": {
      "upi": { "count": 150, "amount": 750000.00 },
      "account_transfer": { "count": 80, "amount": 450000.00 },
      "cash": { "count": 15, "amount": 50000.00 }
    }
  },
  "period": {
    "from": "2024-01-01",
    "to": "2024-12-31"
  }
}
```

---

### GET /api/reports/license-usage

Get license usage report.

**Headers:**
```http
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "license": {
    "licenseKey": "PRM-4XY9Z-8K2L4-M7N3P-C4F6",
    "licenseType": "premium",
    "status": "active",
    "expiryDate": "2025-12-31"
  },
  "currentMonth": "2024-01",
  "usage": {
    "companies": { "used": 3, "limit": 10 },
    "users": { "used": 12, "limit": 50 },
    "vouchers": { "used": 245, "limit": 2000 },
    "sms": { "used": 567, "limit": 5000 }
  },
  "monthlyTrend": [
    {
      "month": "2024-01",
      "vouchers": 245,
      "sms": 567
    }
  ]
}
```

---

## 🔔 Notifications

### GET /api/notifications

Get user notifications.

**Headers:**
```http
Authorization: Bearer {token}
```

**Query Parameters:**
```http
?unread=true
&limit=20
&page=1
```

**Response:**
```json
{
  "success": true,
  "notifications": [
    {
      "id": "uuid",
      "title": "Voucher Pending Approval",
      "message": "Voucher VCH-2024-25-00045 requires your approval",
      "notification_type": "voucher_approval",
      "priority": "high",
      "read": false,
      "action_url": "/vouchers/uuid",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "unread_count": 5,
  "total": 25
}
```

---

### POST /api/notifications/:id/read

Mark notification as read.

**Headers:**
```http
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

---

## ❌ Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `LICENSE_MISSING` | License key not provided | 401 |
| `LICENSE_INVALID_FORMAT` | Invalid license key format | 400 |
| `LICENSE_NOT_FOUND` | License not found in database | 404 |
| `LICENSE_EXPIRED` | License has expired | 403 |
| `LICENSE_SUSPENDED` | License suspended by admin | 403 |
| `LICENSE_HARDWARE_MISMATCH` | Hardware ID doesn't match | 403 |
| `LICENSE_LIMIT_VOUCHERS` | Monthly voucher limit reached | 429 |
| `LICENSE_LIMIT_SMS` | SMS credits exhausted | 429 |
| `AUTH_REQUIRED` | Authentication token required | 401 |
| `TOKEN_EXPIRED` | JWT token has expired | 401 |
| `TOKEN_INVALID` | Invalid JWT token | 401 |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions | 403 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `OTP_INVALID` | Invalid or expired OTP | 400 |
| `USER_NOT_FOUND` | User account not found | 404 |
| `ACCOUNT_LOCKED` | Account temporarily locked | 403 |

---

## 📝 Rate Limits

| Endpoint Pattern | Limit | Window |
|------------------|-------|--------|
| `/api/*` | 100 requests | 15 minutes |
| `/api/auth/login` | 5 attempts | 15 minutes |
| `/api/auth/otp/send` | 3 requests | 10 minutes |
| `/api/licenses/*` | 10 requests | 60 minutes |
| `/api/vouchers` (POST) | 10 requests | 60 seconds |

---

## 🔒 Security Headers

All API responses include:

```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

---

## 📞 Support

**Documentation:** https://docs.example.com  
**API Status:** https://status.example.com  
**Support Email:** api-support@example.com

---

**Version:** 2.0.0  
**Last Updated:** 2024-01-15
