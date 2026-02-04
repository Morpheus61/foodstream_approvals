# 🚀 Deployment Guide - Payment Approval SAAS

Complete guide for deploying to production.

---

## 📋 Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Node.js 18+ installed
- [ ] Database (Supabase) configured
- [ ] SMS provider account setup (Twilio/MSG91)
- [ ] Domain name registered
- [ ] SSL certificate obtained

### 2. Security
- [ ] All secrets generated (32+ characters)
- [ ] Environment variables configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Helmet security headers active

### 3. Database
- [ ] Schema installed
- [ ] Indexes created
- [ ] Row-Level Security policies enabled
- [ ] Backup system configured

### 4. Testing
- [ ] All API endpoints tested
- [ ] License activation tested
- [ ] SMS delivery tested
- [ ] Load testing completed

---

## 🌐 Deployment Options

### Option 1: Vercel (Recommended)

**Pros:**
- ✅ Zero configuration
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Git integration
- ✅ Free tier available

**Steps:**

1. **Prepare Repository**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_REPO_URL
git push -u origin main
```

2. **Connect to Vercel**
   - Visit [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Configure Build Settings**
```json
{
  "buildCommand": "npm install",
  "outputDirectory": "public",
  "installCommand": "npm install",
  "framework": null
}
```

4. **Set Environment Variables**

In Vercel Dashboard → Settings → Environment Variables, add:

```
NODE_ENV=production
PORT=3001

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_key

JWT_SECRET=your_32_byte_secret
ENCRYPTION_KEY=your_32_byte_secret
LICENSE_SECRET=your_license_secret

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_VERIFY_SERVICE_SID=your_verify_sid
TWILIO_MESSAGING_SERVICE_SID=your_messaging_sid

SESSION_SECRET=your_session_secret
ALLOWED_ORIGINS=https://your-domain.com

ENABLE_HARDWARE_LOCK=true
ENABLE_IP_WHITELIST=false
```

5. **Deploy**
```bash
vercel --prod
```

6. **Custom Domain**
   - Vercel Dashboard → Settings → Domains
   - Add your domain
   - Update DNS records as instructed

---

### Option 2: Docker + AWS/DigitalOcean

**Pros:**
- ✅ Full control
- ✅ Flexible scaling
- ✅ Custom infrastructure

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production

# Copy application
COPY . .

# Create logs directory
RUN mkdir -p logs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["npm", "start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped
```

**Build and Deploy:**
```bash
# Build image
docker build -t foodstream-saas:latest .

# Run container
docker run -d \
  --name foodstream-saas \
  -p 3001:3001 \
  --env-file .env \
  --restart unless-stopped \
  foodstream-saas:latest

# Or use docker-compose
docker-compose up -d
```

---

### Option 3: Traditional VPS (Ubuntu)

**Requirements:**
- Ubuntu 20.04+ server
- 2GB RAM minimum
- 20GB storage

**Installation:**

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PM2 (Process Manager)
sudo npm install -g pm2

# 4. Create application directory
sudo mkdir -p /var/www/foodstream-saas
cd /var/www/foodstream-saas

# 5. Clone repository
git clone YOUR_REPO_URL .

# 6. Install dependencies
npm install --production

# 7. Create .env file
sudo nano .env
# (Paste your environment variables)

# 8. Start application with PM2
pm2 start server/index.js --name "foodstream-saas"
pm2 save
pm2 startup

# 9. Install Nginx
sudo apt install -y nginx

# 10. Configure Nginx
sudo nano /etc/nginx/sites-available/foodstream-saas
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Static files
    location / {
        root /var/www/foodstream-saas/public;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # File uploads
    client_max_body_size 10M;
}
```

**Enable Site:**
```bash
sudo ln -s /etc/nginx/sites-available/foodstream-saas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**SSL Certificate (Let's Encrypt):**
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

**Firewall:**
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw enable
```

---

## 🔧 Post-Deployment

### 1. Verify Installation

```bash
# Health check
curl https://your-domain.com/health

# API status
curl https://your-domain.com/api/status

# Expected response:
# {
#   "status": "healthy",
#   "version": "2.0.0",
#   "environment": "production"
# }
```

### 2. Create Super Admin

```bash
# Connect to your server
ssh user@your-server

# Run migration script to create super admin
node server/scripts/createSuperAdmin.js
```

### 3. Generate First License

```bash
# Use Node.js REPL
node

# In REPL:
const LicenseGenerator = require('./server/utils/licenseGenerator');
const license = LicenseGenerator.generateTrialLicense(
    'client@example.com',
    'Client Company',
    '+919876543210'
);
console.log('License Key:', license.licenseKey);
```

### 4. Test SMS Delivery

```bash
# Send test SMS
curl -X POST https://your-domain.com/api/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{
    "mobile": "+919876543210",
    "otpType": "registration",
    "orgId": "your-org-uuid"
  }'
```

---

## 📊 Monitoring

### PM2 Monitoring (VPS Deployment)

```bash
# View logs
pm2 logs foodstream-saas

# Monitor resources
pm2 monit

# Application status
pm2 status

# Restart application
pm2 restart foodstream-saas

# View error logs only
pm2 logs foodstream-saas --err
```

### Application Logs

```bash
# View real-time logs
tail -f logs/combined.log

# View errors
tail -f logs/error.log

# Search logs
grep "LICENSE" logs/combined.log
```

### Database Monitoring

```sql
-- Active connections
SELECT COUNT(*) FROM pg_stat_activity;

-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Recent vouchers
SELECT COUNT(*), DATE(created_at) 
FROM vouchers 
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);
```

---

## 🔄 Continuous Deployment

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 🛡️ Security Hardening

### 1. Environment Variables

```bash
# Generate secure secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encrypt sensitive data
openssl enc -aes-256-cbc -salt -in .env -out .env.enc
```

### 2. Rate Limiting

Already configured in `server/middleware/rateLimiter.js`

### 3. Database Security

```sql
-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

-- Regular backups
-- Set up daily automated backups in Supabase dashboard
```

### 4. SSL/TLS

```bash
# Test SSL configuration
openssl s_client -connect your-domain.com:443 -tls1_2

# Check SSL rating
curl https://www.ssllabs.com/ssltest/analyze.html?d=your-domain.com
```

---

## 📦 Backup & Restore

### Database Backup

```bash
# Manual backup (Supabase)
# Use Supabase Dashboard → Database → Backups

# Or using pg_dump (if direct access)
pg_dump -h db.xxx.supabase.co -U postgres -d postgres > backup.sql
```

### Application Backup

```bash
# Backup uploads and logs
tar -czf backup-$(date +%Y%m%d).tar.gz uploads/ logs/

# Store in cloud storage (S3, etc.)
aws s3 cp backup-$(date +%Y%m%d).tar.gz s3://your-bucket/backups/
```

### Restore

```bash
# Restore database
psql -h db.xxx.supabase.co -U postgres -d postgres < backup.sql

# Restore files
tar -xzf backup-20240115.tar.gz
```

---

## 🔍 Troubleshooting

### Issue: Application won't start

```bash
# Check logs
pm2 logs foodstream-saas --lines 100

# Check environment variables
pm2 env 0

# Restart with fresh environment
pm2 delete foodstream-saas
pm2 start server/index.js --name foodstream-saas
```

### Issue: Database connection error

```bash
# Test connection
node -e "const { createClient } = require('@supabase/supabase-js'); \
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY); \
client.from('licenses').select('count').then(console.log);"
```

### Issue: SMS not sending

```bash
# Test SMS credentials
curl -X POST https://api.twilio.com/2010-04-01/Accounts/YOUR_SID/Messages.json \
  -u YOUR_SID:YOUR_AUTH_TOKEN \
  -d "From=+1234567890" \
  -d "To=+919876543210" \
  -d "Body=Test message"
```

---

## 📞 Support

**Deployment Issues:** deploy-support@example.com  
**System Status:** https://status.example.com  
**Documentation:** https://docs.example.com

---

**Last Updated:** 2024-01-15  
**Version:** 2.0.0
