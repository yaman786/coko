import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kvdmabzxauymhbmazeaa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZG1hYnp4YXV5bWhibWF6ZWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDQ0ODAsImV4cCI6MjA4NzU4MDQ4MH0.zUFwimhx5o5t7sNNCCgwVvlSPek_LaQcCiEbEogr4zk';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@coko.com',
    password: 'Admin@123',
  });

  if (authError) {
    console.error('Login Failed:', authError.message);
    return;
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, name, subcategory')
    .eq('category', 'Drinks')
    .eq('isDeleted', false)
    .order('name');

  if (error) {
    console.error('Error fetching Drinks:', error);
  } else {
    console.log(`Found ${data.length} active Drinks.\n`);
    data.forEach(d => {
        // Enclosing in quotes to easily spot trailing spaces
        console.log(`- ${d.name.padEnd(30, ' ')} | Subcategory: "${d.subcategory}"`);
    });
  }
}
run();
