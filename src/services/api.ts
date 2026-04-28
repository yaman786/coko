
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
    // Portal Context Handshake
    async setPortalContext(portal: 'retail' | 'wholesale'): Promise<void> {
        const { error } = await supabase.rpc('set_portal', { p_portal: portal });
        if (error) {
            console.error('Failed to set DB portal context:', error.message);
            // Non-blocking, but RLS will fail if not set correctly in DB
        }
    },

    // Products
    async getProducts(portal?: 'retail' | 'wholesale'): Promise<Product[]> {
        // Try with portal filter first; if column doesn't exist yet, fall back gracefully
        if (portal) {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('portal', portal)
                .order('name');

            if (!error) return data || [];
            // If the portal column doesn't exist, fall back to unfiltered query
            console.warn('Portal filter failed (column may not exist yet), falling back:', error.message);
        }

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
                portal: product.portal || 'retail',
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

    async getProductAnalytics(startDate: Date, endDate: Date, portal?: 'retail' | 'wholesale'): Promise<any[]> {
        // Try with portal filter first; if RPC doesn't support it yet, fall back gracefully
        if (portal) {
            const { data, error } = await supabase.rpc('get_product_analytics', {
                p_start_date: startDate.toISOString(),
                p_end_date: endDate.toISOString(),
                p_portal: portal
            });
            if (!error) return data || [];
            console.warn('Analytics portal filter failed, falling back:', error.message);
        }

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
        isWaste?: boolean;
        createdAt?: string; // Optional override
        portal?: 'retail' | 'wholesale';
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
            p_complimentary_amount: params.complimentaryAmount || 0,
            p_is_waste: params.isWaste || false,
            p_created_at: params.createdAt || null,
            p_status: params.isWaste ? 'waste' : 'completed'
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

    async getRecentOrders(limit: number = 10, portal?: 'retail' | 'wholesale'): Promise<Order[]> {
        let query = supabase.from('orders').select('*');
        
        if (portal) {
            query = query.eq('portal', portal);
        }

        const { data, error } = await query
            .order('createdAt', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    async getOrdersByDateRange(start: Date, end: Date, portal?: 'retail' | 'wholesale'): Promise<Order[]> {
        let query = supabase.from('orders').select('*');
        
        if (portal) {
            query = query.eq('portal', portal);
        }

        const { data, error } = await query
            .gte('createdAt', start.toISOString())
            .lte('createdAt', end.toISOString())
            .eq('status', 'completed');

        if (error) throw error;
        return data || [];
    },

    // Staff
    async getStaff(includeArchived: boolean = false, portal?: 'retail' | 'wholesale'): Promise<Staff[]> {
        let query = supabase.from('staff').select('*');
        
        if (portal) {
            query = query.eq('portal', portal);
        } else {
            // If no portal specified, default to retail for backward compatibility
            // but in RLS environment, this will only return what the session allows.
        }

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
                portal: staff.role === 'admin' ? 'all' : (staff.portal || 'retail'),
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
    async getStoreSettings(_portal?: 'retail' | 'wholesale'): Promise<StoreSettings | null> {
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
                portal: settings.portal || 'retail',
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
        createdAt?: Date | string;
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
                ...(entry.createdAt && { createdAt: new Date(entry.createdAt).toISOString() })
            });
        } catch {
            // Silently fail — audit logging must never disrupt operations
            console.warn('Audit log write failed (non-critical)');
        }
    },

    async getAuditLog(limit: number = 50, portal?: 'retail' | 'wholesale'): Promise<AuditLogEntry[]> {
        let query = supabase.from('audit_log').select('*');
        
        if (portal) {
            query = query.eq('metadata->>portal', portal);
        }

        const { data, error } = await query
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
    async getExpenses(start?: Date, end?: Date, portal?: 'retail' | 'wholesale'): Promise<Expense[]> {
        let query = supabase.from('expenses').select('*').order('date', { ascending: false });
        
        if (start) query = query.gte('date', start.toISOString());
        if (end) query = query.lte('date', end.toISOString());
        if (portal) query = query.eq('portal', portal);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async upsertExpense(expense: Partial<Expense>): Promise<void> {
        const { error } = await supabase
            .from('expenses')
            .upsert({
                ...expense,
                portal: expense.portal || 'retail'
            });

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
    async getSuppliers(portal?: 'retail' | 'wholesale'): Promise<Supplier[]> {
        // Try with portal filter first; if column doesn't exist yet, fall back gracefully
        if (portal) {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .eq('portal', portal)
                .order('name');

            if (!error) return data || [];
            console.warn('Supplier portal filter failed, falling back:', error.message);
        }

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
            .upsert({
                ...supplier,
                portal: supplier.portal || 'retail',
                updatedAt: new Date()
            });

        if (error) throw error;
    },

    async deleteSupplier(id: string): Promise<void> {
        const { error } = await supabase
            .from('suppliers')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    async getSupplierTransactions(supplierId: string, showDeleted = false): Promise<SupplierTransaction[]> {
        let query = supabase
            .from('supplier_transactions')
            .select('*')
            .eq('supplier_id', supplierId);
        
        if (!showDeleted) {
            query = query.eq('is_deleted', false);
        }

        const { data, error } = await query.order('date', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async upsertSupplierTransaction(transaction: Partial<SupplierTransaction>): Promise<void> {
        const { error } = await supabase
            .from('supplier_transactions')
            .upsert(transaction);

        if (error) throw error;
    },

    async softDeleteSupplierTransaction(id: string): Promise<void> {
        const { error } = await supabase
            .from('supplier_transactions')
            .update({ 
                is_deleted: true, 
                deleted_at: new Date() 
            })
            .eq('id', id);

        if (error) throw error;
    },

    async restoreSupplierTransaction(id: string): Promise<void> {
        const { error } = await supabase
            .from('supplier_transactions')
            .update({ 
                is_deleted: false, 
                deleted_at: null 
            })
            .eq('id', id);

        if (error) throw error;
    },

    async uploadSupplierAttachment(file: File): Promise<string> {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `supplier-attachments/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('coko-assets')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('coko-assets')
            .getPublicUrl(filePath);

        return data.publicUrl;
    }
};
