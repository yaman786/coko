import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvdmabzxauymhbmazeaa.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2ZG1hYnp4YXV5bWhibWF6ZWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMDQ0ODAsImV4cCI6MjA4NzU4MDQ4MH0.zUFwimhx5o5t7sNNCCgwVvlSPek_LaQcCiEbEogr4zk';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Authenticating...");
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@coko.com',
        password: 'Admin@123'
    });

    if (authError) {
        console.error("Auth error:", authError);
        return;
    }

    const stockData = [
        { name: 'Vanilla', stock: 120 },
        { name: 'Strawberry', stock: 100 },
        { name: 'Butterscotch', stock: 90 },
        { name: 'Cookies & Cream', stock: 80 },
        { name: 'Choco Chips', stock: 75 },
        { name: '21st Love', stock: 60 },
        { name: 'Mango', stock: 70 },
        { name: 'Orange', stock: 50 },
        { name: 'Blueberry', stock: 45 },
        { name: 'Kiwi', stock: 40 },
        { name: 'Chocolate', stock: 110 },
        { name: 'Pistachio', stock: 35 },
        { name: 'Honey Dates & Ginger', stock: 30 },
        { name: 'Coffee With Walnuts', stock: 25 },
        { name: 'Dates & Cream', stock: 28 },
        { name: 'Oreo Caramel', stock: 4 },
        { name: 'Banana with Cinnamon', stock: 20 },
        { name: 'Rums & Raisins', stock: 3 },
        { name: 'Royal Rajbhog', stock: 0 },
        { name: 'Small Kulfi (25ml)', stock: 50 },
        { name: 'Big Kulfi (45ml)', stock: 50 },
        { name: '50ml Cup (V/B/S)', stock: 15 },
        { name: '100ml Cup (V/B/S)', stock: 18 },
        { name: '100ml Cup (Chocolate)', stock: 18 },
        { name: 'Mini Chocobar (40ml)', stock: 30 },
        { name: 'Big Chocobar (65ml)', stock: 20 },
        { name: 'Nutty Bar (65ml)', stock: 16 },
        { name: 'Cornetto (V/B/S)', stock: 12 },
        { name: 'Cornetto (Chocolate)', stock: 12 },
        { name: '500ml Tub (V/B/S)', stock: 1 },
        { name: '500ml 21st Love', stock: 1 },
        { name: '500ml Cookies & Cream', stock: 1 },
        { name: '500ml Choco Chips', stock: 1 },
        { name: '500ml Coffee with Walnuts', stock: 1 },
        { name: '1000ml Tub (V/B/S)', stock: 1 },
        { name: '1000ml 21st Love', stock: 1 },
        { name: 'Waffle Cone', stock: 300 },
        { name: 'Vanilla Bubble Tea', stock: 50 },
        { name: 'Strawberry Bubble Tea', stock: 45 },
        { name: 'Butterscotch Bubble Tea', stock: 40 },
        { name: 'Mango Bubble Tea', stock: 55 },
        { name: 'Blueberry Bubble Tea', stock: 35 },
        { name: 'Chocolate Bubble Tea', stock: 60 },
        { name: 'Cookies N Cream Bubble Tea', stock: 30 },
        { name: 'Matcha Bubble Tea', stock: 5 }
    ];

    console.log(`Restoring stock for ${stockData.length} products...`);
    for (const item of stockData) {
        const { error } = await supabase
            .from('products')
            .update({ stock: item.stock })
            .ilike('name', item.name); // Using ilike for case-insensitive match

        if (error) {
            console.error(`Error updating ${item.name}:`, error.message);
        }
    }

    console.log("\n--- RESTORATION COMPLETE ---");
}

run();
