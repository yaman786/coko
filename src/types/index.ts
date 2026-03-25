export interface Product {
    id: string; // SKU or barcode
    name: string;
    price: number; // Selling Price (MRP)
    costPrice?: number;
    category: string;
    subcategory?: string;
    image?: string;
    stock: number;
    lowStockThreshold?: number;
    isBulk?: boolean;
    yield?: number;
    tubCost?: number;
    parentId?: string;
    trackInventory?: boolean;
    stockMultiplier?: number;
    unit?: string;
    updatedAt: Date;
    isDeleted?: boolean;
    user_id?: string;
    portal?: 'retail' | 'wholesale';
}

export interface Expense {
    id: string;
    date: Date;
    category: 'Rent' | 'Salary' | 'Inventory' | 'Utilities' | 'Marketing' | 'Other' | string;
    description: string;
    amount: number;
    payment_method: string;
    cashier_id?: string;
    cashier_name?: string;
    createdat: Date;
    updatedat: Date;
}

export interface Supplier {
    id: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    address?: string;
    current_balance: number;
    portal?: 'retail' | 'wholesale';
    createdAt: Date;
    updatedAt: Date;
}

export interface SupplierTransaction {
    id: string;
    supplier_id: string;
    date: Date;
    type: 'BILL' | 'PAYMENT';
    amount: number;
    payment_method?: string;
    description?: string;
    reference_number?: string;
    attachment_url?: string;
    created_by?: string;
    due_date?: Date;
    is_deleted: boolean;
    deleted_at?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface OrderItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    costPrice?: number;
}

export interface Order {
    id: string; // UUID string
    items: OrderItem[];
    totalAmount: number;
    subtotal: number;
    discount?: number;
    loyalty?: number;
    vat?: number;
    paymentMethod: 'Cash' | 'Card' | 'Split' | 'Other';
    cashAmount?: number;
    cardAmount?: number;
    status: 'completed' | 'pending' | 'cancelled';
    cashierId?: string;
    cashierName?: string;
    isComplimentary?: boolean;
    complimentaryAmount?: number;
    offerTitle?: string;
    offerAmount?: number;
    isWaste?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface Staff {
    id: string; // UUID string
    name: string;
    email: string;
    role: 'admin' | 'cashier';
    updatedAt: Date;
    isDeleted?: boolean;
    user_id?: string;
}

export interface StoreSettings {
    id: number; // Always 1, singleton table
    storeName: string;
    address: string;
    phone: string;
    taxRate: number;
    updatedAt: Date;
}

export interface AuditLogEntry {
    id: string;
    action: string;         // 'ORDER_PLACED', 'PRODUCT_ADDED', etc.
    category: 'POS' | 'INVENTORY' | 'STAFF' | 'SETTINGS';
    description: string;
    metadata: Record<string, unknown>;
    actor_email: string;
    actor_name: string;
    createdAt: Date;
}

// ─── GOD Wholesale Types ─────────────────────────────────

export interface WsProduct {
    id: string;
    name: string;
    category: string;
    unit: 'Carton' | 'Liter' | 'KG' | 'Tray' | 'Piece';
    cost_price: number;
    base_sell_price: number;
    stock: number;
    min_stock: number;
    description?: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface WsClient {
    id: string;
    name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    balance: number;        // Positive = they owe you
    notes?: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface WsClientPricing {
    id: string;
    client_id: string;
    product_id: string;
    sell_price: number;
    created_at: Date;
    updated_at: Date;
}

export interface WsClientTransaction {
    id: string;
    client_id: string;
    amount: number;
    type: 'ORDER_CREDIT' | 'PAYMENT_RECEIVED';
    payment_method?: string;
    reference_id?: string;
    reference_note?: string;
    created_at: Date;
    is_deleted?: boolean;
    deleted_at?: Date;
}

export interface WsOrderItem {
    product_id: string;
    name: string;
    qty: number;
    unit: string;
    rate: number;
    total: number;
}

export interface WsOrder {
    id: string;
    order_number?: string;
    client_id: string;
    client_name: string;
    status: string;
    items: WsOrderItem[];
    subtotal: number;
    discount: number;
    total_amount: number;
    paid_amount: number;
    payment_status: 'unpaid' | 'partial' | 'paid';
    payment_method: 'cash' | 'credit' | 'mixed';
    notes?: string;
    created_by?: string;
    created_at: Date;
    updated_at: Date;
}
