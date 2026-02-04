# 📊 Configurable Pricing System - Complete Guide

## ✅ **YES! Pricing is Fully Configurable**

The pricing system is **100% configurable** through:
1. **Database tables** - No code changes needed
2. **Admin Dashboard** - Web-based UI for managing pricing
3. **API endpoints** - Programmatic access for automation

---

## 🎯 What's Configurable

### **Pricing Plans**
- ✅ Plan name & description
- ✅ Monthly price
- ✅ Annual price (with auto-discount calculation)
- ✅ Currency (HKD, USD, EUR, GBP, etc.)
- ✅ Company limits
- ✅ User limits
- ✅ Voucher limits per month
- ✅ SMS credits
- ✅ Feature flags (JSON)
- ✅ Trial period duration
- ✅ Display order
- ✅ Visibility (show/hide)
- ✅ Featured badge

### **Add-ons**
- ✅ Add-on name & description
- ✅ Price
- ✅ Quantity (e.g., 1000 SMS credits)
- ✅ Billing type (monthly, one-time, per-unit)
- ✅ Category (SMS, users, companies, services)
- ✅ Available for specific plans
- ✅ Display order
- ✅ Visibility

### **Bulk Operations**
- ✅ Currency conversion (all prices)
- ✅ Bulk price adjustments
- ✅ Multi-currency support

---

## 📁 Files Added

### 1. Database Schema
**File:** `database/pricing-config-schema.sql` (8.2KB)

**Contains:**
- `pricing_plans` table - Configurable plan definitions
- `pricing_addons` table - Optional add-ons
- `current_pricing` view - Public pricing view
- Default data (4 plans, 8 add-ons)
- Indexes for performance

### 2. API Routes
**File:** `server/routes/pricing.js` (13.2KB)

**Public Endpoints:**
- `GET /api/pricing/plans` - Get all active plans
- `GET /api/pricing/plans/:code` - Get specific plan
- `GET /api/pricing/addons` - Get add-ons
- `GET /api/pricing/compare` - Get comparison data

**Admin Endpoints (Super Admin only):**
- `GET /api/pricing/admin/plans` - Get all plans (including inactive)
- `POST /api/pricing/admin/plans` - Create new plan
- `PUT /api/pricing/admin/plans/:id` - Update plan
- `DELETE /api/pricing/admin/plans/:id` - Deactivate plan
- `POST /api/pricing/admin/addons` - Create add-on
- `PUT /api/pricing/admin/addons/:id` - Update add-on
- `POST /api/pricing/admin/bulk-update` - Bulk currency conversion

### 3. Admin Dashboard
**File:** `public/admin/pricing.html` (18.7KB)

**Features:**
- Visual pricing plan editor
- Add-on management
- Bulk currency conversion
- Real-time preview
- Responsive design

---

## 🚀 Quick Start

### Step 1: Install Database Schema

```bash
# Run the pricing schema SQL
psql -h your-supabase-host -U postgres -d postgres < database/pricing-config-schema.sql

# Or in Supabase SQL Editor:
# Copy and paste the contents of pricing-config-schema.sql
```

This creates:
- 2 new tables (`pricing_plans`, `pricing_addons`)
- 1 view (`current_pricing`)
- Default pricing data (as configured)

### Step 2: Access Admin Dashboard

```
http://localhost:3001/admin/pricing.html
```

Login required (Super Admin role)

### Step 3: Customize Pricing

**Via Admin Dashboard:**
1. Click "Pricing Plans" tab
2. Click "Edit" on any plan
3. Modify prices, limits, features
4. Save

**Via API:**
```javascript
// Update a plan
await fetch('/api/pricing/admin/plans/PLAN_ID', {
    method: 'PUT',
    headers: {
        'Authorization': 'Bearer YOUR_TOKEN',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        price_monthly: 800.00,
        price_annual: 8640.00,
        max_users: 15
    })
});
```

---

## 💡 Usage Examples

### Example 1: Change Pricing

**Scenario:** Increase Basic plan from HK$720 to HK$800

**Method 1: Admin Dashboard**
1. Go to `/admin/pricing.html`
2. Click "Edit" on Basic plan
3. Change "Monthly Price" to 800
4. Click "Save Plan"

**Method 2: API**
```bash
curl -X PUT http://localhost:3001/api/pricing/admin/plans/PLAN_ID \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price_monthly": 800.00}'
```

**Method 3: Direct SQL**
```sql
UPDATE pricing_plans 
SET price_monthly = 800.00,
    price_annual = 8640.00
WHERE plan_code = 'basic';
```

---

### Example 2: Add New Plan Tier

**Create a "Startup" plan between Basic and Premium:**

```javascript
const newPlan = {
    plan_code: 'startup',
    plan_name: 'Startup',
    plan_description: 'Perfect for startups and growing teams',
    price_monthly: 1200.00,
    price_annual: 12960.00, // 10% discount
    currency: 'HKD',
    max_companies: 5,
    max_users: 25,
    max_vouchers_per_month: 1000,
    sms_credits: 2500,
    features: {
        print: true,
        reports: true,
        api_access: true,
        custom_domain: false,
        white_label: true,
        multi_company: true,
        advanced_analytics: false,
        bulk_operations: true
    },
    display_order: 3, // Between Basic (2) and Premium (4)
    is_visible: true,
    is_featured: true,
    badge_text: 'Most Popular'
};

// Via API
await fetch('/api/pricing/admin/plans', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer TOKEN',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(newPlan)
});
```

---

### Example 3: Currency Conversion

**Convert all pricing from HKD to USD:**

**Via Admin Dashboard:**
1. Go to "Bulk Operations" tab
2. Select "US Dollar (USD)"
3. Enter multiplier: `0.128` (1 HKD = 0.128 USD)
4. Click "Apply Conversion"

**Via API:**
```javascript
await fetch('/api/pricing/admin/bulk-update', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer TOKEN',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        operation: 'currency_conversion',
        currency: 'USD',
        multiplier: 0.128
    })
});
```

**Result:**
- Basic: HK$720 → US$92
- Premium: HK$1920 → US$246

---

### Example 4: Regional Pricing

**Create region-specific plans:**

```sql
-- Hong Kong pricing (default)
INSERT INTO pricing_plans (plan_code, plan_name, price_monthly, currency, max_companies, max_users) 
VALUES ('basic_hk', 'Basic (HK)', 720.00, 'HKD', 3, 10);

-- Singapore pricing
INSERT INTO pricing_plans (plan_code, plan_name, price_monthly, currency, max_companies, max_users) 
VALUES ('basic_sg', 'Basic (SG)', 120.00, 'SGD', 3, 10);

-- US pricing
INSERT INTO pricing_plans (plan_code, plan_name, price_monthly, currency, max_companies, max_users) 
VALUES ('basic_us', 'Basic (US)', 92.00, 'USD', 3, 10);
```

---

### Example 5: Seasonal Promotion

**Create limited-time promotional pricing:**

```javascript
// Create promotional plan
const promoFeatures = {
    plan_code: 'premium_promo',
    plan_name: 'Premium (Limited Offer)',
    plan_description: '50% off for first 100 customers!',
    price_monthly: 960.00, // 50% off HK$1920
    currency: 'HKD',
    max_companies: 10,
    max_users: 50,
    max_vouchers_per_month: 2000,
    sms_credits: 5000,
    features: {/* same as Premium */},
    is_featured: true,
    badge_text: '50% OFF',
    display_order: 2.5, // Show before regular Premium
    status: 'active'
};

// Later, deactivate promotion
await fetch('/api/pricing/admin/plans/PROMO_PLAN_ID', {
    method: 'PUT',
    body: JSON.stringify({ status: 'inactive' })
});
```

---

## 🎨 Admin Dashboard Features

### Pricing Plans Tab
- **View all plans** - Card-based layout
- **Edit plans** - Modal popup form
- **Create plans** - Add button
- **Delete plans** - Soft delete (sets status to inactive)
- **Real-time preview** - See changes immediately

### Add-ons Tab
- **Manage add-ons** - SMS, users, companies, services
- **Category filtering** - Group by type
- **Plan availability** - Specify which plans can use each add-on

### Bulk Operations Tab
- **Currency conversion** - Convert all prices
- **Safety warnings** - Confirm before applying
- **Audit trail** - All changes logged

---

## 🔒 Security & Permissions

### Access Control
- **Public endpoints** - Anyone can view pricing
- **Admin endpoints** - Require `super_admin` role
- **Audit logging** - All changes tracked

### Best Practices
1. **Backup before changes** - Export pricing data
2. **Test in staging** - Verify changes before production
3. **Use version control** - Track pricing changes
4. **Document changes** - Keep changelog

---

## 📊 Default Pricing Data

### Pre-configured Plans

| Code | Name | Price (HKD) | Companies | Users | Vouchers | SMS |
|------|------|-------------|-----------|-------|----------|-----|
| `trial` | Trial | $0 | 1 | 3 | 50 | 100 |
| `basic` | Basic | $720/mo | 3 | 10 | 500 | 1,000 |
| `premium` | Premium | $1,920/mo | 10 | 50 | 2,000 | 5,000 |
| `enterprise` | Enterprise | Custom | ∞ | ∞ | ∞ | ∞ |

### Pre-configured Add-ons

| Code | Name | Price | Category |
|------|------|-------|----------|
| `sms_1k` | 1,000 SMS Credits | $96 | SMS |
| `sms_5k` | 5,000 SMS Credits | $432 | SMS |
| `sms_10k` | 10,000 SMS Credits | $768 | SMS |
| `user_1` | Additional User | $48 | Users |
| `user_10` | 10-User Pack | $432 | Users |
| `company_1` | Additional Company | $96 | Companies |
| `company_5` | 5-Company Pack | $432 | Companies |
| `setup_training` | Setup & Training | $1,920 | Services |

---

## 🔄 Integration with License System

### How It Works

1. **Public View Pricing** → User sees plans on website
2. **User Purchases** → Creates license with selected plan
3. **License Limits** → Copied from `pricing_plans` table
4. **Enforcement** → System checks limits against license
5. **Upgrades** → Update license, apply new limits

### Example Flow

```javascript
// User selects "Premium" plan
const plan = await fetch('/api/pricing/plans/premium').then(r => r.json());

// Create license with plan limits
const license = {
    license_type: plan.plan_code,
    max_companies: plan.max_companies,
    max_users: plan.max_users,
    max_vouchers_per_month: plan.max_vouchers_per_month,
    sms_credits: plan.sms_credits,
    features: plan.features
    // ... other fields
};

// System enforces these limits automatically
```

---

## 🌐 Multi-Currency Support

### Supported Currencies
- HKD - Hong Kong Dollar
- USD - US Dollar
- EUR - Euro
- GBP - British Pound
- SGD - Singapore Dollar
- CNY - Chinese Yuan
- *Any ISO 4217 currency code*

### Conversion Example

```javascript
// Current: All plans in HKD
// Target: Convert to USD

const HKD_TO_USD = 0.128;

await fetch('/api/pricing/admin/bulk-update', {
    method: 'POST',
    body: JSON.stringify({
        operation: 'currency_conversion',
        currency: 'USD',
        multiplier: HKD_TO_USD
    })
});

// Result:
// Basic: HK$720 → US$92.16
// Premium: HK$1920 → US$245.76
```

---

## 📈 Future Enhancements

### Possible Add-ons

1. **Dynamic Pricing**
   - Time-based pricing (peak/off-peak)
   - Volume discounts
   - Loyalty pricing

2. **A/B Testing**
   - Test different price points
   - Track conversion rates
   - Optimize pricing

3. **Coupons & Promotions**
   - Discount codes
   - Limited-time offers
   - Referral bonuses

4. **Usage-Based Billing**
   - Pay per voucher
   - Pay per SMS
   - Overage charges

---

## 🎯 Summary

**Is pricing configurable?** ✅ **YES - 100%**

**What can you configure?**
- ✅ All plan prices (monthly, annual)
- ✅ All limits (companies, users, vouchers, SMS)
- ✅ Features per plan (JSON flags)
- ✅ Add-ons and pricing
- ✅ Currency for all plans
- ✅ Display order and visibility
- ✅ Trial periods

**How to configure?**
- ✅ Admin dashboard (web UI)
- ✅ API endpoints (programmatic)
- ✅ Direct SQL (advanced)

**No code changes needed!** 🎉

---

## 📞 Questions?

**Common Questions:**

**Q: Can I have different prices for different regions?**  
**A:** Yes! Create separate plans with different currencies (e.g., `basic_hk`, `basic_us`)

**Q: Can I create custom plans for specific customers?**  
**A:** Yes! Create a new plan with custom limits, then mark it as invisible (not shown publicly)

**Q: Can I change prices without downtime?**  
**A:** Yes! All pricing is loaded from the database. Changes take effect immediately.

**Q: What happens to existing licenses when I change pricing?**  
**A:** Existing licenses keep their current limits. New licenses get the new limits.

**Q: Can I offer free trials?**  
**A:** Yes! Set `price_monthly` to 0 and configure `trial_days`

---

**Last Updated:** January 28, 2024  
**Version:** 2.0.0 Enhanced with Configurable Pricing
