import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvdmabzxauymhbmazeaa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZG1hYnp4YXV5bWhibWF6ZWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDQ0ODAsImV4cCI6MjA4NzU4MDQ4MH0.zUFwimhx5o5t7sNNCCgwVvlSPek_LaQcCiEbEogr4zk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Authenticating as admin...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@coko.com',
        password: 'Admin@123'
    });

    if (authError) {
        console.error("Auth error:", authError);
        return;
    }
    console.log("Authentication successful.");

    const uuidTables = ['orders', 'audit_log'];
    const bigintTables = ['shifts', 'sync_events'];

    for (const table of uuidTables) {
        console.log(`Wiping UUID table: ${table}...`);
        const { error } = await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) {
            console.error(`Error wiping ${table}:`, error.message);
        } else {
            console.log(`Successfully wiped ${table}.`);
        }
    }

    for (const table of bigintTables) {
        console.log(`Wiping BigInt table: ${table}...`);
        const { error } = await supabase
            .from(table)
            .delete()
            .gt('id', 0); // Correct filter for bigints

        if (error) {
            console.warn(`Note: Could not wipe ${table}, it might be empty or missing from schema cache.`);
        } else {
            console.log(`Successfully wiped ${table}.`);
        }
    }

    console.log("Resetting product stock to 0...");
    const { error: stockError } = await supabase
        .from('products')
        .update({ stock: 0 })
        .neq('id', '00000000-0000-0000-0000-000000000000');

    if (stockError) {
        console.error("Error resetting stock:", stockError.message);
    } else {
        console.log("Successfully reset all product stock to 0.");
    }

    console.log("\n--- WIPE COMPLETE ---");
}

run();
