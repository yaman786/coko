import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvdmabzxauymhbmazeaa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZG1hYnp4YXV5bWhibWF6ZWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDQ0ODAsImV4cCI6MjA4NzU4MDQ4MH0.zUFwimhx5o5t7sNNCCgwVvlSPek_LaQcCiEbEogr4zk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    await supabase.auth.signInWithPassword({
        email: 'admin@coko.com',
        password: 'Admin@123'
    });

    const { error } = await supabase
        .from('products')
        .update({ stock: 0 })
        .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
        console.error("Error resetting stock:", error.message);
    } else {
        console.log("All stock successfully set to 0.");
    }
}

run();
