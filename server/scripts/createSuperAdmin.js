/**
 * Create Super Admin Script
 * Run: node server/scripts/createSuperAdmin.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const SUPER_ADMIN = {
    username: 'SA_Motty',
    password: 'Phes0061',
    fullName: 'Super Admin',
    email: 'compliance@foodstream.co',
    mobile: '+85260528713',
    role: 'super_admin'
};

async function createSuperAdmin() {
    console.log('🚀 Creating Super Admin...\n');

    // Initialize Supabase client
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
    );

    try {
        // Check if user already exists
        const { data: existing } = await supabase
            .from('users')
            .select('id, username')
            .eq('username', SUPER_ADMIN.username)
            .single();

        if (existing) {
            console.log(`⚠️  User "${SUPER_ADMIN.username}" already exists (ID: ${existing.id})`);
            console.log('   Updating password...');
            
            // Update existing user's password
            const passwordHash = await bcrypt.hash(SUPER_ADMIN.password, 12);
            
            const { error: updateError } = await supabase
                .from('users')
                .update({ 
                    password_hash: passwordHash,
                    role: 'super_admin',
                    status: 'active'
                })
                .eq('id', existing.id);

            if (updateError) throw updateError;
            
            console.log('✅ Password updated successfully!\n');
        } else {
            // Hash password
            const passwordHash = await bcrypt.hash(SUPER_ADMIN.password, 12);

            // First, ensure we have an organization
            let orgId = 1;
            const { data: org } = await supabase
                .from('licensed_orgs')
                .select('id')
                .limit(1)
                .single();

            if (!org) {
                // Create default organization
                const { data: newOrg, error: orgError } = await supabase
                    .from('licensed_orgs')
                    .insert({
                        org_name: 'FoodStream Ltd.',
                        org_code: 'FOODSTREAM',
                        contact_email: 'compliance@foodstream.co',
                        contact_phone: '+85260528713',
                        address: 'Office No. 26, 10/F, Beverley Commercial Centre, 87-105 Chatham Road South, Tsim Sha Tsui, Kowloon, Hong Kong',
                        status: 'active',
                        base_currency: 'HKD'
                    })
                    .select()
                    .single();

                if (orgError) {
                    console.log('⚠️  Could not create organization, using org_id = 1');
                } else {
                    orgId = newOrg.id;
                    console.log(`✅ Created organization: ${newOrg.org_name} (ID: ${orgId})`);
                }
            } else {
                orgId = org.id;
            }

            // Create user
            const { data: user, error } = await supabase
                .from('users')
                .insert({
                    username: SUPER_ADMIN.username,
                    full_name: SUPER_ADMIN.fullName,
                    email: SUPER_ADMIN.email,
                    mobile: SUPER_ADMIN.mobile,
                    password_hash: passwordHash,
                    role: SUPER_ADMIN.role,
                    status: 'active',
                    org_id: orgId
                })
                .select()
                .single();

            if (error) throw error;

            console.log('✅ Super Admin created successfully!\n');
            console.log('   User ID:', user.id);
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   LOGIN CREDENTIALS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Username: ${SUPER_ADMIN.username}`);
        console.log(`   Password: ${SUPER_ADMIN.password}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }

    process.exit(0);
}

createSuperAdmin();
