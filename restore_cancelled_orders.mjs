import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvdmabzxauymhbmazeaa.supabase.co';
// Need the service key to bypass RLS, or the anon key + a login. Let's use anon key + login since the user's pushing script used it.
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

    console.log("Fetching all cancelled orders...");
    const { data: cancelledOrders, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'cancelled');

    if (fetchError) {
        console.error("Error fetching orders:", fetchError);
        return;
    }

    console.log(`Found ${cancelledOrders.length} cancelled orders.`);

    if (cancelledOrders.length === 0) {
        console.log("No cancelled orders found. Exiting.");
        return;
    }

    // Aggregate all items that need to be refunded across all cancelled orders
    const stockToRestore = {}; // { productId: totalQuantity }

    for (const order of cancelledOrders) {
        for (const item of order.items) {
            // Check both standard naming conventions just in case
            const productId = item.productId || item.product_id;
            if (!productId) {
                console.warn(`Warning: Could not identify product ID for item in order ${order.id}`, item);
                continue;
            }

            if (!stockToRestore[productId]) {
                stockToRestore[productId] = 0;
            }
            stockToRestore[productId] += item.quantity;
        }
    }

    console.log("Aggregated stock to perfectly restore:");
    console.log(stockToRestore);

    console.log("Applying restoration to Inventory...");
    let successCount = 0;

    for (const [productId, quantityToAdd] of Object.entries(stockToRestore)) {
        // First get current stock
        const { data: product, error: getError } = await supabase
            .from('products')
            .select('stock, name')
            .eq('id', productId)
            .single();

        if (getError || !product) {
            console.error(`Failed to find product ${productId}:`, getError);
            continue;
        }

        const newStock = product.stock + quantityToAdd;
        console.log(`Restoring ${quantityToAdd} scoops of ${product.name}... (Old: ${product.stock} -> New: ${newStock})`);

        const { error: updateError } = await supabase
            .from('products')
            .update({ stock: newStock, updatedAt: new Date() })
            .eq('id', productId);

        if (updateError) {
            console.error(`Failed to update stock for ${product.name}:`, updateError);
        } else {
            successCount++;
        }
    }

    console.log(`✅ Successfully restored inventory for ${successCount} unique products based on old cancelled orders!`);
}

run().catch(console.error);
