/**
 * TEST 2: Stock Validation Logic
 * 
 * Tests the stock validation that prevents overselling.
 * Simulates the same check that PosTerminal runs before checkout.
 */
import { describe, it, expect } from 'vitest';
import type { Product } from '../types';
import type { CartItem } from '../store/usePosStore';

// Exact same validation logic used in PosTerminal.tsx → handleCheckout
function validateStockForCheckout(
    cart: CartItem[],
    products: Product[]
): { valid: boolean; insufficientItems: string[] } {
    const insufficientItems = cart
        .filter(cartItem => {
            const product = products.find(p => p.id === cartItem.id);
            return !product || product.stock < cartItem.quantity;
        })
        .map(item => item.name);

    return {
        valid: insufficientItems.length === 0,
        insufficientItems,
    };
}

function mockProduct(overrides: Partial<Product> = {}): Product {
    return {
        id: 'prod-001',
        name: 'Vanilla Small',
        price: 99,
        category: 'Scoops',
        stock: 50,
        updatedAt: new Date(),
        ...overrides,
    };
}

function mockCartItem(overrides: Partial<CartItem> = {}): CartItem {
    return {
        ...mockProduct(),
        quantity: 1,
        ...overrides,
    };
}

describe('Stock Validation — Prevent Overselling', () => {
    it('allows checkout when stock is sufficient', () => {
        const products = [mockProduct({ id: 'p1', stock: 10 })];
        const cart = [mockCartItem({ id: 'p1', quantity: 5 })];

        const result = validateStockForCheckout(cart, products);
        expect(result.valid).toBe(true);
        expect(result.insufficientItems).toHaveLength(0);
    });

    it('blocks checkout when stock is insufficient', () => {
        const products = [mockProduct({ id: 'p1', name: 'Water Bottle', stock: 2 })];
        const cart = [mockCartItem({ id: 'p1', name: 'Water Bottle', quantity: 5 })];

        const result = validateStockForCheckout(cart, products);
        expect(result.valid).toBe(false);
        expect(result.insufficientItems).toContain('Water Bottle');
    });

    it('blocks checkout when stock is exactly 0', () => {
        const products = [mockProduct({ id: 'p1', name: 'Sold Out Ice', stock: 0 })];
        const cart = [mockCartItem({ id: 'p1', name: 'Sold Out Ice', quantity: 1 })];

        const result = validateStockForCheckout(cart, products);
        expect(result.valid).toBe(false);
    });

    it('blocks checkout when product does not exist in inventory', () => {
        const products: Product[] = []; // empty inventory
        const cart = [mockCartItem({ id: 'ghost-product', name: 'Ghost Item', quantity: 1 })];

        const result = validateStockForCheckout(cart, products);
        expect(result.valid).toBe(false);
        expect(result.insufficientItems).toContain('Ghost Item');
    });

    it('allows checkout when quantity exactly equals stock', () => {
        const products = [mockProduct({ id: 'p1', stock: 5 })];
        const cart = [mockCartItem({ id: 'p1', quantity: 5 })];

        const result = validateStockForCheckout(cart, products);
        expect(result.valid).toBe(true);
    });

    it('validates each item independently in a multi-item cart', () => {
        const products = [
            mockProduct({ id: 'p1', name: 'Vanilla', stock: 10 }),
            mockProduct({ id: 'p2', name: 'Chocolate', stock: 1 }),
        ];
        const cart = [
            mockCartItem({ id: 'p1', name: 'Vanilla', quantity: 5 }),  // OK
            mockCartItem({ id: 'p2', name: 'Chocolate', quantity: 3 }), // NOT OK
        ];

        const result = validateStockForCheckout(cart, products);
        expect(result.valid).toBe(false);
        expect(result.insufficientItems).toEqual(['Chocolate']);
    });
});
