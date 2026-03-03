import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvdmabzxauymhbmazeaa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZG1hYnp4YXV5bWhibWF6ZWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDQ0ODAsImV4cCI6MjA4NzU4MDQ4MH0.zUFwimhx5o5t7sNNCCgwVvlSPek_LaQcCiEbEogr4zk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('name, price, stock, category')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    console.log(`\n=== FOUND ${data.length} PRODUCTS ===\n`);

    let currentCategory = '';
    data.forEach((p, index) => {
        if (p.category !== currentCategory) {
            console.log(`\n[${p.category.toUpperCase()}]`);
            currentCategory = p.category;
        }
        console.log(`${index + 1}. ${p.name} - Nrs. ${p.price} (Stock: ${p.stock})`);
    });
}

checkProducts();
