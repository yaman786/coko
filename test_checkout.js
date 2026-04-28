import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("Testing process_order RPC...");
    const { data, error } = await supabase.rpc('process_order', {
        p_order_id: "test-uuid-1234",
        p_items: [{ product_id: "test", name: "test", price: 10, quantity: 1, cost_price: 5 }],
        p_total_amount: 10,
        p_subtotal: 10,
        p_discount: 0,
        p_loyalty: 0,
        p_vat: 0,
        p_payment_method: "Cash",
        p_cash_amount: 10,
        p_card_amount: 0,
        p_cashier_id: "admin",
        p_cashier_name: "admin",
        p_is_complimentary: false,
        p_offer_title: null,
        p_offer_amount: 0,
        p_complimentary_amount: 0,
        p_is_waste: false,
        p_created_at: null,
        p_portal: "retail"
    });
    console.log("Result:", data);
    console.log("Error:", error);
}

run();
