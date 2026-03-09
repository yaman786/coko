import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvdmabzxauymhbmazeaa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZG1hYnp4YXV5bWhibWF6ZWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDQ0ODAsImV4cCI6MjA4NzU4MDQ4MH0.zUFwimhx5o5t7sNNCCgwVvlSPek_LaQcCiEbEogr4zk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function yieldAudit() {
    await supabase.auth.signInWithPassword({ email: 'admin@coko.com', password: 'Admin@123' });

    const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('isBulk', true)
        .eq('isDeleted', false)
        .lt('yield', 23)
        .order('yield', { ascending: true });

    console.log('--- SUSPICIOUS YIELD REPORT (Yield < 23) ---');
    console.log(JSON.stringify(products, null, 2));
}

yieldAudit();
