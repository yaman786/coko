import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kvdmabzxauymhbmazeaa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZG1hYnp4YXV5bWhibWF6ZWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDQ0ODAsImV4cCI6MjA4NzU4MDQ4MH0.zUFwimhx5o5t7sNNCCgwVvlSPek_LaQcCiEbEogr4zk';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, parentId, category, tubCost, yield, stockMultiplier, costPrice')
    .eq('isDeleted', false);

  if (error) console.error(error);
  else {
      console.log("Total products:", data.length);
      const food = data.filter(d => d.category && d.category.toLowerCase().includes('food'));
      const salt = data.filter(d => Boolean(d.name) && d.name.toLowerCase().includes('salt'));
      const car = data.filter(d => Boolean(d.name) && d.name.toLowerCase().includes('caramel'));
      const ch = data.filter(d => Boolean(d.name) && d.name.toLowerCase().includes('cheese'));
      console.table([...food, ...salt, ...car, ...ch].slice(0, 30));
  }
}
run();
