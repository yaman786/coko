import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvdmabzxauymhbmazeaa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZG1hYnp4YXV5bWhibWF6ZWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDQ0ODAsImV4cCI6MjA4NzU4MDQ4MH0.zUFwimhx5o5t7sNNCCgwVvlSPek_LaQcCiEbEogr4zk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const STANDARD_YIELD = 24;

async function normalizeYields() {
    console.log('--- STARTING YIELD NORMALIZATION ---');
    console.log(`Target Standard Yield: ${STANDARD_YIELD}`);

    // Authenticate
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@coko.com',
        password: 'Admin@123'
    });

    if (authError) {
        console.error('Auth Failed:', authError.message);
        return;
    }
    console.log('Authenticated successfully.\n');

    // Fetch the specific items needing fixing (yield < 23)
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('isBulk', true)
        .eq('isDeleted', false)
        .lt('yield', 23);

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    if (!products || products.length === 0) {
        console.log('✅ No products found with yield < 23. Normalization complete.');
        return;
    }

    console.log(`Found ${products.length} products to normalize.\n`);

    let successCount = 0;

    for (const p of products) {
        const oldYield = p.yield;
        const oldCost = p.costPrice;
        const newCost = p.tubCost / STANDARD_YIELD;

        console.log(`Updating ${p.name}...`);
        console.log(`  - Yield: ${oldYield} -> ${STANDARD_YIELD}`);
        console.log(`  - Cost: Nrs. ${Number(oldCost).toFixed(2)} -> Nrs. ${newCost.toFixed(2)}`);

        // Update the product record
        const { error: updateError } = await supabase
            .from('products')
            .update({
                yield: STANDARD_YIELD,
                costPrice: newCost,
                updatedAt: new Date().toISOString()
            })
            .eq('id', p.id);

        if (updateError) {
            console.error(`  ❌ Failed to update ${p.name}: ${updateError.message}`);
            continue;
        }

        // Log the fix in the audit trail
        const { error: logError } = await supabase
            .from('audit_log')
            .insert({
                id: crypto.randomUUID(),
                action: 'PRODUCT_UPDATED',
                category: 'INVENTORY',
                description: `SYSTEM FIX: Normalized yield for "${p.name}" from ${oldYield} to ${STANDARD_YIELD}. Cost corrected from Nrs. ${Number(oldCost).toFixed(2)} to Nrs. ${newCost.toFixed(2)}.`,
                metadata: {
                    productId: p.id,
                    oldYield,
                    newYield: STANDARD_YIELD,
                    oldCostPrice: oldCost,
                    newCostPrice: newCost,
                    reason: 'Data sanity normalization'
                },
                actor_email: 'system.admin@coko.com',
                actor_name: 'Data Normalization Script'
            });

        if (logError) {
            console.warn(`  ⚠️ Product updated, but failed to write audit log: ${logError.message}`);
        }

        console.log(`  ✅ ${p.name} successfully normalized.\n`);
        successCount++;
    }

    console.log('--- NORMALIZATION COMPLETE ---');
    console.log(`Successfully fixed ${successCount} out of ${products.length} anomalous products.`);
}

normalizeYields();
