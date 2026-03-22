import { supabase } from '../lib/supabase';
import type { WsProduct, WsClient, WsClientPricing, WsOrder, WsClientTransaction } from '../types';

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

    // ─── Client Transactions (Ledger) ─────────────────────

    async getClientTransactions(clientId: string): Promise<WsClientTransaction[]> {
        const { data, error } = await supabase
            .from('ws_client_transactions')
            .select('*')
            .eq('client_id', clientId)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async recordClientPayment(clientId: string, amount: number, method: string, notes?: string): Promise<void> {
        // 1. Get current balance
        const client = await this.getClientById(clientId);
        if (!client) throw new Error("Client not found");

        // 2. Insert PAYMENT_RECEIVED transaction
        const { error: txError } = await supabase
            .from('ws_client_transactions')
            .insert({
                client_id: clientId,
                amount: amount,
                type: 'PAYMENT_RECEIVED',
                payment_method: method,
                reference_note: notes
            });
        if (txError) throw txError;

        // 3. Deduct from balance
        const newBalance = client.balance - amount;
        await this.updateClientBalance(clientId, newBalance);
    },

    async updateClientTransaction(
        txId: string, 
        clientId: string, 
        newAmount: number, 
        oldAmount: number, 
        type: 'PAYMENT_RECEIVED' | 'ORDER_CREDIT', 
        updates: Partial<WsClientTransaction>
    ): Promise<void> {
        const client = await this.getClientById(clientId);
        if (!client) throw new Error("Client not found");

        const difference = newAmount - oldAmount;

        const { error: txError } = await supabase
            .from('ws_client_transactions')
            .update(updates)
            .eq('id', txId);
            
        if (txError) throw txError;

        if (difference !== 0) {
            let newBalance = client.balance;
            if (type === 'PAYMENT_RECEIVED') {
                newBalance -= difference;
            } else if (type === 'ORDER_CREDIT') {
                newBalance += difference;
            }
            await this.updateClientBalance(clientId, newBalance);
        }
    },

    async deleteClientTransaction(txId: string, clientId: string, amount: number, type: 'PAYMENT_RECEIVED' | 'ORDER_CREDIT'): Promise<void> {
        const client = await this.getClientById(clientId);
        if (!client) throw new Error("Client not found");

        const { error: txError } = await supabase
            .from('ws_client_transactions')
            .update({ is_deleted: true })
            .eq('id', txId);
            
        if (txError) throw txError;

        let newBalance = client.balance;
        if (type === 'PAYMENT_RECEIVED') {
            newBalance += amount; 
        } else if (type === 'ORDER_CREDIT') {
            newBalance -= amount; 
        }
        
        await this.updateClientBalance(clientId, newBalance);
    },

    /**
     * Fetch aggregated product purchase insights for a specific client.
     */
    async getClientProductAnalytics(clientId: string): Promise<{
        product_id: string;
        name: string;
        unit: string;
        total_qty: number;
        total_revenue: number;
    }[]> {
        const { data, error } = await supabase
            .rpc('get_ws_client_product_analytics', {
                p_client_id: clientId
            });

        if (error) throw error;
        return data || [];
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

    async createOrder(order: Partial<WsOrder>): Promise<WsOrder> {
        const { data, error } = await supabase
            .from('ws_orders')
            .insert(order)
            .select()
            .single();
        if (error) throw error;
        return data;
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
        const createdOrder = await this.createOrder(order);

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

        // 3. Update client balance (add what they owe) and record CREDIT ledger transaction
        if (order.client_id && order.total_amount !== undefined && order.paid_amount !== undefined) {
            const client = await this.getClientById(order.client_id);
            if (client) {
                const creditAmount = order.total_amount - order.paid_amount;
                
                if (creditAmount > 0) {
                    // Record chronological debt
                    await supabase
                        .from('ws_client_transactions')
                        .insert({
                            client_id: order.client_id,
                            amount: creditAmount,
                            type: 'ORDER_CREDIT',
                            reference_id: createdOrder.id,
                            reference_note: 'Supply order credit'
                        });

                    await this.updateClientBalance(
                        order.client_id,
                        client.balance + creditAmount
                    );
                }
            }
        }
    },

    /**
     * Cancel a supply order: 
     * 1. Revert Inventory (+qty for all items)
     * 2. Delete the created ORDER_CREDIT from client timeline (which automatically reverses balance)
     * 3. Change order status to 'cancelled' (so it drops from analytics)
     */
    async cancelSupplyOrder(orderId: string, clientId: string, items: { product_id: string; qty: number }[]): Promise<void> {
        // 1. Mark Order as Cancelled
        const { error: orderError } = await supabase
            .from('ws_orders')
            .update({ status: 'cancelled', updated_at: new Date() })
            .eq('id', orderId);
        if (orderError) throw orderError;

        // 2. Revert Inventory (Add stock back)
        for (const item of items) {
            const product = await supabase
                .from('ws_products')
                .select('stock')
                .eq('id', item.product_id)
                .single();

            if (product.data) {
                const newStock = product.data.stock + item.qty;
                await this.updateStock(item.product_id, newStock);
            }
        }

        // 3. Revert Ledger Debt (Find the ORDER_CREDIT and delete it)
        const { data: tx } = await supabase
            .from('ws_client_transactions')
            .select('id, amount, type')
            .eq('reference_id', orderId)
            .eq('client_id', clientId)
            .eq('type', 'ORDER_CREDIT')
            .maybeSingle();

        if (tx) {
            await this.deleteClientTransaction(tx.id, clientId, tx.amount, tx.type as any);
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
    },

    // ─── Analytics ────────────────────────────────────────
    
    async getDashboardStats() {
        // Parallel fetch for speed
        const [products, clients, orders] = await Promise.all([
            this.getProducts(),
            this.getClients(),
            this.getOrders(1000) // All recent orders for accurate revenue
        ]);

        const totalVolume = products.reduce((sum, p) => sum + (p.stock || 0), 0);
        const totalCredits = clients.reduce((sum, c) => sum + (c.balance || 0), 0);
        const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
        const receivedRevenue = orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
        
        // Factory Debt: Placeholder or calculated from a 'debts' table if we add one later
        const factoryDebt = 0; 

        return {
            totalVolume,
            totalCredits,
            totalRevenue,
            receivedRevenue,
            factoryDebt
        };
    }
};
