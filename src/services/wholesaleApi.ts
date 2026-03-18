import { supabase } from '../lib/supabase';
import type { WsProduct, WsClient, WsClientPricing, WsOrder } from '../types';

/**
 * GOD Wholesale API — Completely separate from retail api.ts
 * All tables use ws_ prefix for isolation
 */
export const wholesaleApi = {

    // ─── Products ─────────────────────────────────────────

    async getProducts(): Promise<WsProduct[]> {
        const { data, error } = await supabase
            .from('ws_products')
            .select('*')
            .order('name');
        if (error) throw error;
        return data || [];
    },

    async getActiveProducts(): Promise<WsProduct[]> {
        const { data, error } = await supabase
            .from('ws_products')
            .select('*')
            .eq('is_active', true)
            .order('name');
        if (error) throw error;
        return data || [];
    },

    async upsertProduct(product: Partial<WsProduct>): Promise<void> {
        const { error } = await supabase
            .from('ws_products')
            .upsert({ ...product, updated_at: new Date() });
        if (error) throw error;
    },

    async deleteProduct(id: string): Promise<void> {
        const { error } = await supabase
            .from('ws_products')
            .update({ is_active: false, updated_at: new Date() })
            .eq('id', id);
        if (error) throw error;
    },

    async updateStock(id: string, newStock: number): Promise<void> {
        const { error } = await supabase
            .from('ws_products')
            .update({ stock: newStock, updated_at: new Date() })
            .eq('id', id);
        if (error) throw error;
    },

    // ─── Clients ──────────────────────────────────────────

    async getClients(): Promise<WsClient[]> {
        const { data, error } = await supabase
            .from('ws_clients')
            .select('*')
            .eq('is_active', true)
            .order('name');
        if (error) throw error;
        return data || [];
    },

    async getClientById(id: string): Promise<WsClient | null> {
        const { data, error } = await supabase
            .from('ws_clients')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return null;
        return data;
    },

    async upsertClient(client: Partial<WsClient>): Promise<void> {
        const { error } = await supabase
            .from('ws_clients')
            .upsert({ ...client, updated_at: new Date() });
        if (error) throw error;
    },

    async deleteClient(id: string): Promise<void> {
        const { error } = await supabase
            .from('ws_clients')
            .update({ is_active: false, updated_at: new Date() })
            .eq('id', id);
        if (error) throw error;
    },

    async updateClientBalance(id: string, balance: number): Promise<void> {
        const { error } = await supabase
            .from('ws_clients')
            .update({ balance, updated_at: new Date() })
            .eq('id', id);
        if (error) throw error;
    },

    // ─── Client Pricing ───────────────────────────────────

    async getClientPricing(clientId: string): Promise<WsClientPricing[]> {
        const { data, error } = await supabase
            .from('ws_client_pricing')
            .select('*')
            .eq('client_id', clientId);
        if (error) throw error;
        return data || [];
    },

    async upsertClientPricing(pricing: Partial<WsClientPricing>): Promise<void> {
        const { error } = await supabase
            .from('ws_client_pricing')
            .upsert({ ...pricing, updated_at: new Date() }, {
                onConflict: 'client_id,product_id'
            });
        if (error) throw error;
    },

    async deleteClientPricing(id: string): Promise<void> {
        const { error } = await supabase
            .from('ws_client_pricing')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    // ─── Orders ───────────────────────────────────────────

    async getOrders(limit: number = 100): Promise<WsOrder[]> {
        const { data, error } = await supabase
            .from('ws_orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) throw error;
        return data || [];
    },

    async getOrdersByClient(clientId: string): Promise<WsOrder[]> {
        const { data, error } = await supabase
            .from('ws_orders')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async createOrder(order: Partial<WsOrder>): Promise<void> {
        const { error } = await supabase
            .from('ws_orders')
            .insert(order);
        if (error) throw error;
    },

    async updateOrderPayment(id: string, paidAmount: number, status: 'unpaid' | 'partial' | 'paid'): Promise<void> {
        const { error } = await supabase
            .from('ws_orders')
            .update({
                paid_amount: paidAmount,
                payment_status: status,
                updated_at: new Date()
            })
            .eq('id', id);
        if (error) throw error;
    },

    // ─── Composite Operations ─────────────────────────────

    /**
     * Create a supply order + deduct stock + update client balance
     * All in one flow (not a DB transaction, but logically grouped)
     */
    async processSupplyOrder(order: Partial<WsOrder>, items: { product_id: string; qty: number }[]): Promise<void> {
        // 1. Create the order
        await this.createOrder(order);

        // 2. Deduct stock for each item
        for (const item of items) {
            const product = await supabase
                .from('ws_products')
                .select('stock')
                .eq('id', item.product_id)
                .single();

            if (product.data) {
                const newStock = Math.max(0, product.data.stock - item.qty);
                await this.updateStock(item.product_id, newStock);
            }
        }

        // 3. Update client balance (add what they owe)
        if (order.client_id && order.total_amount !== undefined && order.paid_amount !== undefined) {
            const client = await this.getClientById(order.client_id);
            if (client) {
                const creditAmount = order.total_amount - order.paid_amount;
                await this.updateClientBalance(
                    order.client_id,
                    client.balance + creditAmount
                );
            }
        }
    },

    /**
     * Get the effective sell price for a product for a given client
     * Priority: client_pricing → base_sell_price
     */
    async getEffectivePrice(clientId: string, productId: string): Promise<number | null> {
        // Check for client-specific price
        const { data } = await supabase
            .from('ws_client_pricing')
            .select('sell_price')
            .eq('client_id', clientId)
            .eq('product_id', productId)
            .maybeSingle();

        if (data) return data.sell_price;

        // Fall back to base sell price
        const { data: product } = await supabase
            .from('ws_products')
            .select('base_sell_price')
            .eq('id', productId)
            .single();

        return product?.base_sell_price ?? null;
    },

    /**
     * Get all prices for a client (bulk fetch for order creation)
     */
    async getAllClientPrices(clientId: string): Promise<Map<string, number>> {
        const { data } = await supabase
            .from('ws_client_pricing')
            .select('product_id, sell_price')
            .eq('client_id', clientId);

        const priceMap = new Map<string, number>();
        for (const row of (data || [])) {
            priceMap.set(row.product_id, row.sell_price);
        }
        return priceMap;
    }
};
