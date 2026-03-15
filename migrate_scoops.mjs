import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kvdmabzxauymhbmazeaa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZG1hYnp4YXV5bWhibWF6ZWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDQ0ODAsImV4cCI6MjA4NzU4MDQ4MH0.zUFwimhx5o5t7sNNCCgwVvlSPek_LaQcCiEbEogr4zk';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const categoryMapping = {
  'Classic Flavors': ['Vanilla', 'Cookies and Cream', 'Strawberry', 'Chocochips', 'Blueberry', 'Butterscotch'],
  'Exotic Flavors': ['21st Love', 'Mango', 'Kiwi', 'Chocolate', 'Pistachio'],
  'Signature Flavors': ['Honey Dates with Ginger', 'Coffee with Walnuts', 'Dates and Cream', 'Oreo Caramel', 'Rums and Raisins', 'Banana with Cinamon'],
  'Fantasy Flavors': ['Royal Rajbhog']
};

async function run() {
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@coko.com',
    password: 'Admin@123',
  });

  if (authError) {
    console.error('Login Failed:', authError.message);
    return;
  }

  console.log('Starting Migration...');

  let totalUpdated = 0;

  for (const [subcategory, flavors] of Object.entries(categoryMapping)) {
    for (const flavorName of flavors) {
      // Find matching scoops
      const { data, error: fetchErr } = await supabase
        .from('products')
        .select('id, name')
        .eq('category', 'Scoops')
        .eq('isDeleted', false)
        .ilike('name', flavorName + '%');

      if (fetchErr) {
        console.error(`Error fetching ${flavorName}:`, fetchErr);
        continue;
      }

      if (data && data.length > 0) {
        // Update all variants (e.g. half/full tub)
        const ids = data.map(d => d.id);
        const { error: updateErr } = await supabase
          .from('products')
          .update({ subcategory: subcategory })
          .in('id', ids);

        if (updateErr) {
          console.error(`Error updating ${flavorName}:`, updateErr);
        } else {
          console.log(`Updated ${data.length} records for ${flavorName} -> ${subcategory}`);
          totalUpdated += data.length;
        }
      } else {
        console.log(`Skipped ${flavorName} (not found in DB)`);
      }
    }
  }

  console.log(`\nMigration completed! Successfully updated ${totalUpdated} total Scoop variants.`);
}
run();
