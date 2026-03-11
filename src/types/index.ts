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
