# FoodStream Ltd. - Digital Signature System

## Overview

Every voucher in the FoodStream White-Label Payment Approval System is cryptographically signed using **HMAC-SHA256** to ensure:
- **Data Integrity**: Detect any tampering with voucher data
- **Authenticity**: Verify the voucher was created by an authorized system
- **Non-repudiation**: Provide audit trail with timestamped signatures
- **Legal Compliance**: Meet digital signature requirements for financial documents

---

## Signature Format

### What It Looks Like

```
a7f3c2e9b8d1f4a6c3e8b2d5f1a9c7e4b3d6f2a8c5e1b9d4f7a3c6e2b8d5f1a4
```

**Characteristics:**
- **Length**: 64 hexadecimal characters
- **Algorithm**: HMAC-SHA256
- **Encoding**: Lowercase hexadecimal
- **Storage**: VARCHAR(64) in database
- **Uniqueness**: Each voucher has a unique signature based on its data

---

## How It's Generated

### 1. **Signature Payload**

The signature is computed from critical voucher data:

```javascript
const signaturePayload = {
  voucher_number: 'VCH-2024-25-00001',
  company_id: 'abc123',
  org_id: 'org456',
  payee_id: 'payee789',
  amount: 15000.00,
  payment_mode: 'UPI',
  head_of_account: 'Marketing',
  created_at: '2024-01-28T10:30:00.000Z',
  created_by: 'user123'
};
```

### 2. **Canonicalization**

Data is converted to a canonical string format:

```
VCH-2024-25-00001|abc123|org456|payee789|15000.00|UPI|Marketing|2024-01-28T10:30:00.000Z|user123
```

**Rules:**
- Fields separated by pipe `|` character
- Amounts rounded to 2 decimal places
- ISO 8601 timestamps
- Consistent field order

### 3. **HMAC-SHA256 Hashing**

```javascript
const crypto = require('crypto');

function generateSignature(payload, secret) {
  const canonical = [
    payload.voucher_number,
    payload.company_id,
    payload.org_id,
    payload.payee_id,
    payload.amount.toFixed(2),
    payload.payment_mode,
    payload.head_of_account,
    payload.created_at,
    payload.created_by
  ].join('|');
  
  return crypto
    .createHmac('sha256', secret)
    .update(canonical)
    .digest('hex');
}
```

### 4. **Secret Key Management**

Each **organization** has a unique signing secret:

```sql
-- Stored securely in licensed_orgs table
org_signing_secret: AES-256 encrypted value
```

**Security Practices:**
- 32+ character random secret per organization
- Encrypted at rest using AES-256-CBC
- Decrypted only during signing/verification
- Rotated annually or on security events
- Never logged or exposed in APIs

---

## Signature Verification

### Process Flow

```
1. Retrieve voucher data from database
2. Fetch organization's signing secret
3. Reconstruct canonical payload
4. Generate expected signature
5. Compare with stored signature (constant-time)
6. Check signature timestamp validity
```

### Implementation

```javascript
function verifyVoucherSignature(voucherData, storedSignature, orgSecret) {
  const expectedSignature = generateSignature(voucherData, orgSecret);
  
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(storedSignature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
```

### Verification Points

**Automatic Verification:**
- ✅ On voucher retrieval (GET /api/vouchers/:id)
- ✅ Before approval workflow
- ✅ Before payment completion
- ✅ During audit report generation
- ✅ On voucher print/export

**Manual Verification:**
```http
POST /api/vouchers/:voucherId/verify-signature
Authorization: Bearer <jwt_token>

Response:
{
  "valid": true,
  "voucher_number": "VCH-2024-25-00001",
  "signature": "a7f3c2e9...",
  "signature_timestamp": "2024-01-28T10:30:00.000Z",
  "verified_at": "2024-01-28T15:45:00.000Z"
}
```

---

## Visual Examples

### Example 1: Valid Voucher Signature

**Voucher Details:**
```json
{
  "voucher_number": "VCH-2024-25-00123",
  "company": "Relish Foods Pvt Ltd",
  "payee": "ABC Suppliers",
  "amount": 25000.00,
  "payment_mode": "Account Transfer",
  "created_at": "2024-01-28T10:00:00Z"
}
```

**Canonical String:**
```
VCH-2024-25-00123|c1a2b3|o4d5e6|p7f8g9|25000.00|Account Transfer|Raw Materials|2024-01-28T10:00:00Z|usr_001
```

**Generated Signature:**
```
3f7a9c2e1b5d8f4a6c3e7b2d9f5a1c8e4b6d3f7a2c9e5b1d8f4a7c3e6b2d9f5a1
```

**Display on Voucher:**
```
┌──────────────────────────────────────────────────────────┐
│ PAYMENT VOUCHER - Relish Foods Pvt Ltd                  │
│ VCH-2024-25-00123                                        │
├──────────────────────────────────────────────────────────┤
│ Payee: ABC Suppliers                                     │
│ Amount: HK$ 25,000.00                                    │
│ Mode: Account Transfer                                   │
├──────────────────────────────────────────────────────────┤
│ Digital Signature (SHA-256):                             │
│ 3f7a9c2e1b5d8f4a6c3e7b2d9f5a1c8e4b6d3f7a2c9e5b1d8f4... │
│ Signed: 2024-01-28 10:00:00 UTC                          │
│ [✓ VERIFIED]                                             │
└──────────────────────────────────────────────────────────┘
```

### Example 2: Tampered Voucher Detection

**Original Signature:**
```
3f7a9c2e1b5d8f4a6c3e7b2d9f5a1c8e4b6d3f7a2c9e5b1d8f4a7c3e6b2d9f5a1
```

**If Amount Changed from HK$25,000 → HK$35,000:**

**New Canonical String:**
```
VCH-2024-25-00123|c1a2b3|o4d5e6|p7f8g9|35000.00|Account Transfer|Raw Materials|2024-01-28T10:00:00Z|usr_001
```

**Re-computed Signature:**
```
8a4c6e2b9f5d1a7c3e8b6d2f9a5c1e7b4d3f6a2c8e5b1d9f4a7c3e6b2d8f5a1c4
```

**Verification Result:**
```
❌ SIGNATURE MISMATCH
Expected: 3f7a9c2e1b5d8f4a6c3e7b2d9f5a1c8e...
Actual:   8a4c6e2b9f5d1a7c3e8b6d2f9a5c1e7b...

⚠️  TAMPERING DETECTED
Voucher data has been modified after signing
Action: REJECT PAYMENT | ALERT ADMIN | LOG INCIDENT
```

---

## Storage & Database

### Schema

```sql
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_number VARCHAR(50) UNIQUE NOT NULL,
  -- ... other voucher fields ...
  digital_signature VARCHAR(64) NOT NULL,
  signature_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature_verified BOOLEAN DEFAULT FALSE,
  last_verification_at TIMESTAMPTZ
);

-- Index for signature lookups
CREATE INDEX idx_vouchers_signature ON vouchers(digital_signature);
```

### Audit Trail

```sql
CREATE TABLE signature_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_id UUID REFERENCES vouchers(id),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_by UUID REFERENCES users(id),
  verification_result VARCHAR(20), -- 'VALID', 'INVALID', 'EXPIRED'
  signature_checked VARCHAR(64),
  ip_address INET,
  user_agent TEXT
);
```

---

## Security Considerations

### ✅ **Strengths**

1. **Collision Resistance**: SHA-256 makes it computationally infeasible to find two inputs with the same hash
2. **Secret Key**: HMAC requires the organization's secret key, preventing forgery
3. **Tamper Detection**: Any modification to voucher data invalidates the signature
4. **Timestamping**: Signature timestamp proves when the voucher was created
5. **Audit Trail**: All verification attempts are logged

### ⚠️ **Limitations**

1. **Not Public-Key Cryptography**: Uses symmetric HMAC (shared secret), not asymmetric PKI
2. **Secret Compromise**: If org secret is leaked, signatures can be forged
3. **Clock Dependency**: Relies on accurate system timestamps
4. **No Timestamping Authority**: Self-signed timestamps (not RFC 3161 compliant)

### 🔒 **Mitigation Strategies**

**For Enhanced Security (Optional Upgrades):**

```javascript
// 1. Add counter-signing by approver
function counterSign(voucher, approverSecret) {
  const originalSig = voucher.digital_signature;
  const approverPayload = `${originalSig}|${voucher.approved_by}|${voucher.approved_at}`;
  return crypto.createHmac('sha256', approverSecret).update(approverPayload).digest('hex');
}

// 2. Add blockchain anchoring
async function anchorToBlockchain(voucher) {
  const hash = voucher.digital_signature;
  const tx = await blockchain.submit({
    data: hash,
    timestamp: voucher.signature_timestamp
  });
  return tx.id; // Store as voucher.blockchain_tx_id
}

// 3. Add PKI support (RSA signatures)
function signWithPrivateKey(payload, privateKey) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(JSON.stringify(payload));
  return sign.sign(privateKey, 'hex');
}
```

---

## API Integration

### Signing During Voucher Creation

```http
POST /api/vouchers
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "company_id": "abc123",
  "payee_id": "payee789",
  "amount": 15000,
  "payment_mode": "UPI",
  "head_of_account": "Marketing",
  "description": "Marketing campaign payment"
}

Response:
{
  "success": true,
  "voucher": {
    "id": "v12345",
    "voucher_number": "VCH-2024-25-00001",
    "amount": 15000,
    "digital_signature": "a7f3c2e9b8d1f4a6c3e7b2d5f1a9c7e4b3d6f2a8c5e1b9d4f7a3c6e2b8d5f1a4",
    "signature_timestamp": "2024-01-28T10:30:00.000Z",
    "status": "pending_approval"
  }
}
```

### Verifying Before Approval

```http
GET /api/vouchers/v12345
Authorization: Bearer <jwt_token>

Response:
{
  "voucher": { ... },
  "signature_status": {
    "valid": true,
    "verified_at": "2024-01-28T12:00:00.000Z",
    "message": "Signature valid - voucher data intact"
  }
}
```

### Verification Endpoint

```http
POST /api/vouchers/v12345/verify-signature
Authorization: Bearer <jwt_token>

Response:
{
  "valid": true,
  "voucher_number": "VCH-2024-25-00001",
  "signature": "a7f3c2e9...",
  "original_data_hash": "3f7a9c2e...",
  "current_data_hash": "3f7a9c2e...",
  "match": true,
  "signature_age_seconds": 7200,
  "verified_by": "admin_user_123"
}
```

---

## Display on Printed Vouchers

### Full Signature Display

```
┌─────────────────────────────────────────────────────────────┐
│  RELISH FOODS PVT LTD                      [COMPANY LOGO]   │
│  Kanyakumari, Tamil Nadu                                    │
│  GST: 33AAACR7749E2ZD                                       │
├─────────────────────────────────────────────────────────────┤
│  PAYMENT VOUCHER                                            │
│  No: VCH-2024-25-00123                Date: 28 Jan 2024     │
├─────────────────────────────────────────────────────────────┤
│  PAY TO: ABC Suppliers Pvt Ltd                              │
│  AMOUNT: HK$ 25,000.00 (Twenty Five Thousand Dollars Only)  │
│  MODE: Account Transfer                                     │
│  ACCOUNT: Raw Materials                                     │
├─────────────────────────────────────────────────────────────┤
│  DESCRIPTION:                                               │
│  Purchase of raw materials for Q1 2024 production          │
├─────────────────────────────────────────────────────────────┤
│  APPROVALS:                                                 │
│  Created by: John Doe (Accounts)      28 Jan 2024 10:00    │
│  Approved by: Jane Smith (Admin)      28 Jan 2024 11:30    │
│  Payment OTP: Verified ✓              28 Jan 2024 12:00    │
├─────────────────────────────────────────────────────────────┤
│  DIGITAL SIGNATURE (SHA-256):                               │
│  3f7a9c2e1b5d8f4a6c3e7b2d9f5a1c8e4b6d3f7a2c9e5b1d8f4a7c3 │
│  e6b2d9f5a1                                                 │
│  Signed: 2024-01-28 10:00:00 UTC                            │
│  Status: ✓ VERIFIED & VALID                                │
├─────────────────────────────────────────────────────────────┤
│  VERIFICATION:                                              │
│  Scan QR code or visit:                                     │
│  https://verify.foodstream.com/VCH-2024-25-00123            │
│                                                             │
│     █▀▀▀▀▀█ ▄▀▀▄█ █▀▀▀▀▀█                                 │
│     █ ███ █ █▀▄▀█ █ ███ █      [QR CODE]                   │
│     █ ▀▀▀ █ ▄█ ▄▀ █ ▀▀▀ █                                 │
│     ▀▀▀▀▀▀▀ ▀ █ ▀ ▀▀▀▀▀▀▀                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Truncated Signature (Space-Saving)

```
Digital Signature: 3f7a9c2e...d9f5a1 (SHA-256)
Signed: 2024-01-28 10:00 UTC ✓ Verified
```

### QR Code Content

```json
{
  "voucher_number": "VCH-2024-25-00123",
  "amount": 25000,
  "signature": "3f7a9c2e1b5d8f4a6c3e7b2d9f5a1c8e4b6d3f7a2c9e5b1d8f4a7c3e6b2d9f5a1",
  "verify_url": "https://verify.foodstream.com/VCH-2024-25-00123"
}
```

---

## Future Enhancements

### 1. **Public-Key Infrastructure (PKI)**
Replace HMAC with RSA/ECDSA signatures for non-repudiation:
- Organization has private key (signs)
- Public key distributed (anyone can verify)
- Certificate Authority (CA) trust chain

### 2. **Blockchain Anchoring**
Submit signature hashes to blockchain for immutable timestamping:
- Ethereum/Polygon smart contract
- IPFS hash storage
- Public verification without revealing voucher data

### 3. **Hardware Security Modules (HSM)**
Store organization secrets in tamper-proof hardware:
- FIPS 140-2 Level 3 compliance
- Cloud HSM (AWS CloudHSM, Azure Key Vault)
- USB HSM tokens for offline signing

### 4. **Multi-Signature Workflows**
Require multiple approvers to sign:
- Accounts team member signs (HMAC-1)
- Admin approver counter-signs (HMAC-2)
- Finance director final signature (HMAC-3)
- All signatures required to complete payment

### 5. **Legal Digital Signatures**
Comply with eIDAS (EU) / Aadhaar eSign (India):
- Qualified Electronic Signatures (QES)
- Aadhaar-based eSign integration
- Time-Stamping Authority (TSA) RFC 3161

---

## Comparison: HMAC vs PKI

| Feature | **HMAC-SHA256** (Current) | **RSA/ECDSA** (PKI) |
|---------|---------------------------|---------------------|
| **Algorithm** | Symmetric (shared secret) | Asymmetric (public/private keys) |
| **Key Management** | One secret per org | Key pairs, certificates |
| **Verification** | Requires secret key | Public key only |
| **Non-repudiation** | No (both parties have secret) | Yes (only signer has private key) |
| **Legal Status** | Internal audit only | Legally binding (with CA) |
| **Performance** | Fast (~10μs) | Slower (~500μs for RSA-2048) |
| **Complexity** | Low | Medium-High |
| **Best For** | Internal integrity checks | Legal/regulatory compliance |

---

## Sample Code: Complete Implementation

```javascript
// server/utils/voucherSignature.js
const crypto = require('crypto');
const { getOrgSigningSecret } = require('./encryption');

/**
 * Generate digital signature for a voucher
 */
async function signVoucher(voucherData, orgId) {
  // Fetch org secret (decrypted)
  const orgSecret = await getOrgSigningSecret(orgId);
  
  // Create canonical string
  const canonical = [
    voucherData.voucher_number,
    voucherData.company_id,
    voucherData.org_id,
    voucherData.payee_id,
    parseFloat(voucherData.amount).toFixed(2),
    voucherData.payment_mode,
    voucherData.head_of_account,
    voucherData.created_at,
    voucherData.created_by
  ].join('|');
  
  // Generate HMAC-SHA256
  const signature = crypto
    .createHmac('sha256', orgSecret)
    .update(canonical)
    .digest('hex');
  
  return {
    signature,
    timestamp: new Date().toISOString()
  };
}

/**
 * Verify voucher signature
 */
async function verifyVoucher(voucherData, storedSignature, orgId) {
  const orgSecret = await getOrgSigningSecret(orgId);
  const { signature: expectedSignature } = await signVoucher(voucherData, orgId);
  
  // Constant-time comparison
  const valid = crypto.timingSafeEqual(
    Buffer.from(storedSignature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
  
  return {
    valid,
    expected: expectedSignature,
    actual: storedSignature,
    verified_at: new Date().toISOString()
  };
}

/**
 * Log verification attempt
 */
async function logVerification(voucherId, result, userId) {
  await db.query(`
    INSERT INTO signature_verifications 
    (voucher_id, verified_at, verified_by, verification_result, signature_checked)
    VALUES ($1, NOW(), $2, $3, $4)
  `, [voucherId, userId, result.valid ? 'VALID' : 'INVALID', result.actual]);
}

module.exports = {
  signVoucher,
  verifyVoucher,
  logVerification
};
```

---

## Testing & Validation

### Unit Test Example

```javascript
const { signVoucher, verifyVoucher } = require('./voucherSignature');

describe('Voucher Digital Signatures', () => {
  const testVoucher = {
    voucher_number: 'VCH-2024-25-TEST',
    company_id: 'test_company',
    org_id: 'test_org',
    payee_id: 'test_payee',
    amount: 10000.50,
    payment_mode: 'UPI',
    head_of_account: 'Testing',
    created_at: '2024-01-28T10:00:00.000Z',
    created_by: 'test_user'
  };
  
  test('should generate valid signature', async () => {
    const { signature } = await signVoucher(testVoucher, 'test_org');
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });
  
  test('should verify valid signature', async () => {
    const { signature } = await signVoucher(testVoucher, 'test_org');
    const result = await verifyVoucher(testVoucher, signature, 'test_org');
    expect(result.valid).toBe(true);
  });
  
  test('should reject tampered data', async () => {
    const { signature } = await signVoucher(testVoucher, 'test_org');
    const tamperedVoucher = { ...testVoucher, amount: 50000 };
    const result = await verifyVoucher(tamperedVoucher, signature, 'test_org');
    expect(result.valid).toBe(false);
  });
});
```

---

## Compliance & Legal

### India - IT Act 2000

**Section 3**: Electronic signature recognized as legally valid

**Requirements:**
- ✅ Signature uniquely linked to the signatory
- ✅ Capable of identifying the signatory
- ✅ Created using means under exclusive control of signatory
- ✅ Linked to data such that tampering is detectable

**Status**: ⚠️ HMAC signatures meet technical requirements but may need PKI/Aadhaar eSign for full legal recognition

### Hong Kong - Electronic Transactions Ordinance

**Cap. 553**: Electronic signatures admissible in court

**Requirements:**
- ✅ Identifies person signing
- ✅ Indicates approval of information
- ✅ Reliable in context

**Status**: ✅ Digital signatures acceptable for business transactions

---

## Summary

| Aspect | Details |
|--------|---------|
| **Algorithm** | HMAC-SHA256 |
| **Signature Length** | 64 hexadecimal characters |
| **Secret Key** | 32+ chars, AES-256 encrypted, per-organization |
| **Payload** | Canonical string of critical voucher fields |
| **Storage** | `digital_signature` VARCHAR(64) in vouchers table |
| **Verification** | Automatic on retrieval + manual API endpoint |
| **Audit Trail** | `signature_verifications` table logs all checks |
| **Display** | Full signature on printed vouchers + QR code |
| **Security** | Tamper-proof, collision-resistant, timestamped |
| **Limitations** | Symmetric HMAC (not PKI), self-signed timestamps |
| **Upgrade Path** | RSA/ECDSA PKI, blockchain anchoring, HSM storage |

---

## Contact & Support

**FoodStream Ltd.**  
Digital Security Team  
Hong Kong

**Documentation Version**: 2.0.1  
**Last Updated**: January 28, 2024

For security issues or questions about digital signatures, contact:  
📧 security@foodstream.com  
🔒 PGP Key: [View Public Key]

---

**🔐 Your vouchers are cryptographically secured.**
