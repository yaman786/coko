import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = 'https://kvdmabzxauymhbmazeaa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZG1hYnp4YXV5bWhibWF6ZWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDQ0ODAsImV4cCI6MjA4NzU4MDQ4MH0.zUFwimhx5o5t7sNNCCgwVvlSPek_LaQcCiEbEogr4zk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@coko.com',
        password: 'Admin@123'
    });

    if (authError) {
        console.error("Auth error:", authError);
        return;
    }

    console.log("Wiping existing products...");
    await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const products = [
        // Classic Scoops (100)
        { name: 'Vanilla', category: 'Scoops', price: 100, stock: 0 },
        { name: 'Strawberry', category: 'Scoops', price: 100, stock: 0 },
        { name: 'Butterscotch', category: 'Scoops', price: 100, stock: 0 },

        // Exotic Scoops (140)
        { name: 'Cookies & Cream', category: 'Scoops', price: 140, stock: 0 },
        { name: 'Choco Chips', category: 'Scoops', price: 140, stock: 0 },
        { name: '21st Love', category: 'Scoops', price: 140, stock: 0 },
        { name: 'Mango', category: 'Scoops', price: 140, stock: 0 },
        { name: 'Orange', category: 'Scoops', price: 140, stock: 0 },
        { name: 'Blueberry', category: 'Scoops', price: 140, stock: 0 },
        { name: 'Kiwi', category: 'Scoops', price: 140, stock: 0 },
        { name: 'Chocolate', category: 'Scoops', price: 140, stock: 0 },
        { name: 'Pistachio', category: 'Scoops', price: 140, stock: 0 },

        // Signature Scoops (180)
        { name: 'Honey Dates & Ginger', category: 'Scoops', price: 180, stock: 0 },
        { name: 'Coffee With walnuts', category: 'Scoops', price: 180, stock: 0 },
        { name: 'Dates & cream', category: 'Scoops', price: 180, stock: 0 },
        { name: 'Oreo caramel', category: 'Scoops', price: 180, stock: 0 },

        // Fantasy Scoops (200)
        { name: 'Banana with Cinamon', category: 'Scoops', price: 200, stock: 0 },
        { name: 'Rums & Raisins', category: 'Scoops', price: 200, stock: 0 },
        { name: 'Royal Rajbhog', category: 'Scoops', price: 200, stock: 0 },

        // Add-ons
        { name: 'Waffle Cone', category: 'Add-ons', price: 20, stock: 0 },

        // Bubble Tea (250 - 280)
        { name: 'Vanilla Bubble Tea', category: 'Bubble Tea', price: 250, stock: 0 },
        { name: 'Strawberry Bubble Tea', category: 'Bubble Tea', price: 250, stock: 0 },
        { name: 'Butterscotch Bubble Tea', category: 'Bubble Tea', price: 250, stock: 0 },
        { name: 'Mango Bubble Tea', category: 'Bubble Tea', price: 250, stock: 0 },
        { name: 'Blueberry Bubble Tea', category: 'Bubble Tea', price: 250, stock: 0 },
        { name: 'Chocolate Bubble Tea', category: 'Bubble Tea', price: 250, stock: 0 },
        { name: 'Cookies N Cream Bubble Tea', category: 'Bubble Tea', price: 250, stock: 0 },
        { name: 'Matcha Bubble Tea', category: 'Bubble Tea', price: 280, stock: 0 },

        // Bio-products
        { name: 'Small kulfi (25ml)', category: 'Bio-products', price: 15, stock: 0 },
        { name: 'Big Kulfi (45ml)', category: 'Bio-products', price: 25, stock: 0 },
        { name: '50ml Cup (V/B/S)', category: 'Bio-products', price: 30, stock: 0 },
        { name: '100ml Cup(V/B/S)', category: 'Bio-products', price: 50, stock: 0 },
        { name: '100ml Cup (Chocolate)', category: 'Bio-products', price: 60, stock: 0 },
        { name: 'Mini Chocobar(40ml)', category: 'Bio-products', price: 40, stock: 0 },
        { name: 'Big Chocobar (65ml)', category: 'Bio-products', price: 65, stock: 0 },
        { name: 'Nutty bar (65ml)', category: 'Bio-products', price: 80, stock: 0 },
        { name: 'Cornetto(V/B/S)', category: 'Bio-products', price: 90, stock: 0 },
        { name: 'Cornetto(Chocolate)', category: 'Bio-products', price: 100, stock: 0 },
        { name: '500 ml (V/B/S)', category: 'Bio-products', price: 190, stock: 0 },
        { name: '500ml 21st Love', category: 'Bio-products', price: 240, stock: 0 },
        { name: '500ml Cookies&Cream', category: 'Bio-products', price: 290, stock: 0 },
        { name: '500ml Choco Chips', category: 'Bio-products', price: 300, stock: 0 },
        { name: '500ml Coffee with walnuts', category: 'Bio-products', price: 280, stock: 0 },
        { name: '1000ml (V/B/S)', category: 'Bio-products', price: 350, stock: 0 },
        { name: '1000ml (21stlove)', category: 'Bio-products', price: 370, stock: 0 }
    ];

    const productsWithId = products.map(p => ({ ...p, id: crypto.randomUUID() }));

    console.log(`Pushing ${productsWithId.length} products to live DB...`);
    const { data: insertData, error: insertError } = await supabase.from('products').insert(productsWithId).select();

    if (insertError) {
        console.error("Insert error:", insertError);
        return;
    }

    console.log(`Successfully injected ${insertData.length} products!\n`);

    const { data: freshData, error: fetchError } = await supabase
        .from('products')
        .select('name, price, stock, category')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

    if (fetchError) {
        console.error('Error fetching verification data:', fetchError);
        return;
    }

    console.log(`=== LIVE DB VERIFICATION: FOUND ${freshData.length} PRODUCTS ===`);

    let currentCategory = '';
    freshData.forEach((p, index) => {
        if (p.category !== currentCategory) {
            console.log(`\n[${p.category.toUpperCase()}]`);
            currentCategory = p.category;
        }
        console.log(`${index + 1}. ${p.name.padEnd(28, ' ')} | Nrs. ${p.price.toString().padEnd(4, ' ')} | Stock: ${p.stock}`);
    });
}
run();
