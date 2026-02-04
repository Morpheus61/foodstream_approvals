#!/bin/bash

# =======================================================
# FoodStream Ltd. White-Label Payment SAAS - Quick Setup Script
# =======================================================

set -e  # Exit on error

echo "========================================"
echo "🚀 Relish Payment SAAS - Setup"
echo "========================================"
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current version: $(node -v)"
    echo "Please upgrade Node.js: https://nodejs.org/"
    exit 1
fi
echo "✓ Node.js $(node -v) detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# Create .env file
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file..."
    cp .env.example .env
    echo "✓ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env file with your credentials:"
    echo "   - Supabase URL and keys"
    echo "   - SMS provider credentials"
    echo "   - Generate secure secrets"
    echo ""
else
    echo "✓ .env file already exists"
    echo ""
fi

# Generate secrets
echo "🔐 Generating secrets..."
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
LICENSE_SECRET=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")

echo ""
echo "Generated secrets (add these to your .env file):"
echo "-----------------------------------------------"
echo "JWT_SECRET=$JWT_SECRET"
echo "ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo "LICENSE_SECRET=$LICENSE_SECRET"
echo "-----------------------------------------------"
echo ""

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p logs
echo "✓ Logs directory created"
echo ""

# Database setup instructions
echo "🗄️  Database Setup:"
echo "-------------------"
echo "1. Create a Supabase project at https://supabase.com"
echo "2. Go to SQL Editor in Supabase dashboard"
echo "3. Copy and run the SQL from: database/schema.sql"
echo "4. Add Supabase URL and keys to .env file"
echo ""

# Test setup
echo "🧪 Testing setup..."
if [ -f .env ]; then
    echo "✓ Environment file present"
else
    echo "⚠️  Environment file missing"
fi

if [ -d node_modules ]; then
    echo "✓ Dependencies installed"
else
    echo "⚠️  Dependencies not installed"
fi
echo ""

# Next steps
echo "========================================"
echo "✅ Setup Complete!"
echo "========================================"
echo ""
echo "Next Steps:"
echo "-----------"
echo "1. Edit .env file with your credentials"
echo "2. Setup database using database/schema.sql"
echo "3. Run: npm start"
echo "4. Visit: http://localhost:3001"
echo ""
echo "Documentation:"
echo "--------------"
echo "- README.md - Main documentation"
echo "- docs/API.md - API documentation"
echo "- docs/DEPLOYMENT.md - Deployment guide"
echo "- docs/ONBOARDING-UI.md - UI design guide"
echo ""
echo "Support:"
echo "--------"
echo "Email: support@example.com"
echo "GitHub: https://github.com/your-repo"
echo ""
echo "Happy building! 🎉"
echo ""
