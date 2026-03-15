import { supabase } from '../lib/supabase';
import type { Product, Order, Staff, StoreSettings, AuditLogEntry, Expense, Supplier, SupplierTransaction } from '../types';

/** Strongly-typed payload for order items sent to the checkout RPC */
export interface OrderItemPayload {
    product_id: string;
    name: string;
    price: number;
    quantity: number;
    cost_price?: number;
}

export const api = {
    // Products
    async getProducts(): Promise<Product[]> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name');

        if (error) throw error;
        return data || [];
    },

    async getProductById(id: string): Promise<Product | null> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return data;
    },

    async upsertProduct(product: Product): Promise<void> {
        const { error } = await supabase
            .from('products')
            .upsert({
                ...product,
                updatedAt: new Date()
            });

        if (error) throw error;
    },

    async updateStock(id: string, newStock: number): Promise<void> {
        const { error } = await supabase
            .from('products')
            .update({ stock: newStock, updatedAt: new Date() })
            .eq('id', id);

        if (error) throw error;
    },

    async getProductAnalytics(startDate: Date, endDate: Date): Promise<any[]> {
        const { data, error } = await supabase.rpc('get_product_analytics', {
            p_start_date: startDate.toISOString(),
            p_end_date: endDate.toISOString()
        });
        if (error) throw error;
        return data || [];
    },

    async processOrder(params: {
        id: string;
        items: OrderItemPayload[];
        totalAmount: number;
        subtotal: number;
        discount: number;
        loyalty: number;
        vat: number;
        paymentMethod: string;
        cashAmount: number;
        cardAmount: number;
        cashierId: string;
        cashierName: string;
        isComplimentary: boolean;
        complimentaryAmount?: number;
        offerTitle?: string;
        offerAmount?: number;
    }): Promise<void> {
        const { error } = await supabase.rpc('process_order', {
            p_order_id: params.id,
            p_items: params.items,
            p_total_amount: params.totalAmount,
            p_subtotal: params.subtotal,
            p_discount: params.discount,
            p_loyalty: params.loyalty,
            p_vat: params.vat,
            p_payment_method: params.paymentMethod,
            p_cash_amount: params.cashAmount,
            p_card_amount: params.cardAmount,
            p_cashier_id: params.cashierId,
            p_cashier_name: params.cashierName,
            p_is_complimentary: params.isComplimentary,
            p_offer_title: params.offerTitle || null,
            p_offer_amount: params.offerAmount || 0,
            p_complimentary_amount: params.complimentaryAmount || 0
        });

        if (error) throw error;
    },

    // Orders
    async updateOrder(id: string, updates: Partial<Order>, actorEmail: string, actorName: string): Promise<void> {
        const { error } = await supabase
            .from('orders')
            .update({ ...updates, updatedAt: new Date() })
            .eq('id', id);

        if (error) throw error;

        // Audit Trail
        api.logActivity({
            action: 'ORDER_UPDATED',
            category: 'POS',
            description: `Order #${id.slice(0, 8)} was updated via Admin.`,
            metadata: { orderId: id, updates },
            actor_email: actorEmail,
            actor_name: actorName,
        });
    },

    async deleteOrder(id: string, actorEmail: string, actorName: string): Promise<void> {
        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Audit Trail
        api.logActivity({
            action: 'ORDER_DELETED',
            category: 'POS',
            description: `Order #${id.slice(0, 8)} was permanently deleted.`,
            metadata: { orderId: id },
            actor_email: actorEmail,
            actor_name: actorName,
        });
    },

    async getRecentOrders(limit: number = 10): Promise<Order[]> {

        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('createdAt', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    async getOrdersByDateRange(start: Date, end: Date): Promise<Order[]> {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .gte('createdAt', start.toISOString())
            .lte('createdAt', end.toISOString())
            .eq('status', 'completed');

        if (error) throw error;
        return data || [];
    },

    // Staff
    async getStaff(includeArchived: boolean = false): Promise<Staff[]> {
        let query = supabase.from('staff').select('*');
        if (!includeArchived) {
            query = query.eq('isDeleted', false);
        }

        const { data, error } = await query.order('name');
        if (error) throw error;
        return data || [];
    },

    async upsertStaff(staff: Staff): Promise<void> {
        const { error } = await supabase
            .from('staff')
            .upsert({
                ...staff,
                user_id: staff.user_id, // Ensure user_id is passed
                updatedAt: new Date()
            });

        if (error) throw error;
    },

    async updateStaff(id: string, updates: Partial<Staff>): Promise<void> {
        const { error } = await supabase
            .from('staff')
            .update({
                ...updates,
                updatedAt: new Date()
            })
            .eq('id', id);

        if (error) throw error;
    },

    // Store Settings
    async getStoreSettings(): Promise<StoreSettings | null> {
        const { data, error } = await supabase
            .from('storeSettings')
            .select('*')
            .eq('id', 1)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    async updateStoreSettings(settings: StoreSettings): Promise<void> {
        const { error } = await supabase
            .from('storeSettings')
            .upsert({
                ...settings,
                updatedAt: new Date()
            });

        if (error) throw error;
    },

    // ─── Audit Trail ─────────────────────────────────────────
    /**
     * Log an activity to the audit trail.
     * Fire-and-forget: never throws, never blocks user workflows.
     */
    async logActivity(entry: {
        action: string;
        category: AuditLogEntry['category'];
        description: string;
        metadata?: Record<string, unknown>;
        actor_email?: string;
        actor_name?: string;
    }): Promise<void> {
        try {
            await supabase.from('audit_log').insert({
                id: crypto.randomUUID(),
                action: entry.action,
                category: entry.category,
                description: entry.description,
                metadata: entry.metadata || {},
                actor_email: entry.actor_email || 'system',
                actor_name: entry.actor_name || 'System',
            });
        } catch {
            // Silently fail — audit logging must never disrupt operations
            console.warn('Audit log write failed (non-critical)');
        }
    },

    async getAuditLog(limit: number = 50): Promise<AuditLogEntry[]> {
        const { data, error } = await supabase
            .from('audit_log')
            .select('*')
            .order('createdAt', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    async getAuditLogsByProduct(productId: string): Promise<AuditLogEntry[]> {
        // We use the contains operator for the JSONB metadata column
        // This finds logs where the metadata JSON object contains { "productId": productId }
        const { data, error } = await supabase
            .from('audit_log')
            .select('*')
            .contains('metadata', { productId: productId })
            .order('createdAt', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    // Expenses
    async getExpenses(start?: Date, end?: Date): Promise<Expense[]> {
        let query = supabase.from('expenses').select('*').order('date', { ascending: false });
        
        if (start) query = query.gte('date', start.toISOString());
        if (end) query = query.lte('date', end.toISOString());

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async upsertExpense(expense: Partial<Expense>): Promise<void> {
        const { error } = await supabase
            .from('expenses')
            .upsert(expense);

        if (error) throw error;
    },

    async deleteExpense(id: string): Promise<void> {
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    // Suppliers
    async getSuppliers(): Promise<Supplier[]> {
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .order('name');

        if (error) throw error;
        return data || [];
    },

    async upsertSupplier(supplier: Partial<Supplier>): Promise<void> {
        const { error } = await supabase
            .from('suppliers')
            .upsert(supplier);

        if (error) throw error;
    },

    async deleteSupplier(id: string): Promise<void> {
        const { error } = await supabase
            .from('suppliers')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async getSupplierTransactions(supplierId: string): Promise<SupplierTransaction[]> {
        const { data, error } = await supabase
            .from('supplier_transactions')
            .select('*')
            .eq('supplier_id', supplierId)
            .order('date', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async addSupplierTransaction(transaction: Partial<SupplierTransaction>): Promise<void> {
        const { error } = await supabase
            .from('supplier_transactions')
            .insert(transaction);

        if (error) throw error;
    },

    async deleteSupplierTransaction(id: string): Promise<void> {
        const { error } = await supabase
            .from('supplier_transactions')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
