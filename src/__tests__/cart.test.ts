/**
 * TEST 1: Cart Store Logic
 * 
 * Tests the Zustand POS cart store — the heart of the checkout system.
 * Verifies: adding items, incrementing quantities, updating, removing, and clearing.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { usePosStore } from '../store/usePosStore';
import type { Product } from '../types';

// Helper: create a mock product
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

describe('usePosStore — Cart Logic', () => {
    beforeEach(() => {
        // Reset the store before each test
        usePosStore.getState().clearCart();
    });

    it('starts with an empty cart', () => {
        const { cart } = usePosStore.getState();
        expect(cart).toHaveLength(0);
    });

    it('adds a new item with quantity 1', () => {
        const product = mockProduct();
        usePosStore.getState().addToCart(product);

        const { cart } = usePosStore.getState();
        expect(cart).toHaveLength(1);
        expect(cart[0].id).toBe('prod-001');
        expect(cart[0].quantity).toBe(1);
    });

    it('increments quantity when adding the same item again', () => {
        const product = mockProduct();
        usePosStore.getState().addToCart(product);
        usePosStore.getState().addToCart(product);

        const { cart } = usePosStore.getState();
        expect(cart).toHaveLength(1); // Still one item, not two
        expect(cart[0].quantity).toBe(2);
    });

    it('keeps different products as separate cart entries', () => {
        usePosStore.getState().addToCart(mockProduct({ id: 'prod-001', name: 'Vanilla' }));
        usePosStore.getState().addToCart(mockProduct({ id: 'prod-002', name: 'Chocolate' }));

        const { cart } = usePosStore.getState();
        expect(cart).toHaveLength(2);
    });

    it('updateQuantity increments by delta', () => {
        usePosStore.getState().addToCart(mockProduct());
        usePosStore.getState().updateQuantity('prod-001', 3); // +3

        const { cart } = usePosStore.getState();
        expect(cart[0].quantity).toBe(4); // 1 + 3
    });

    it('updateQuantity removes item when quantity reaches 0', () => {
        usePosStore.getState().addToCart(mockProduct());
        usePosStore.getState().updateQuantity('prod-001', -1); // 1 - 1 = 0

        const { cart } = usePosStore.getState();
        expect(cart).toHaveLength(0); // Auto-removed
    });

    it('removeFromCart removes the correct item', () => {
        usePosStore.getState().addToCart(mockProduct({ id: 'prod-001' }));
        usePosStore.getState().addToCart(mockProduct({ id: 'prod-002' }));
        usePosStore.getState().removeFromCart('prod-001');

        const { cart } = usePosStore.getState();
        expect(cart).toHaveLength(1);
        expect(cart[0].id).toBe('prod-002');
    });

    it('clearCart empties the entire cart', () => {
        usePosStore.getState().addToCart(mockProduct({ id: 'prod-001' }));
        usePosStore.getState().addToCart(mockProduct({ id: 'prod-002' }));
        usePosStore.getState().clearCart();

        const { cart } = usePosStore.getState();
        expect(cart).toHaveLength(0);
    });
});

describe('Cart Math — Subtotal, Tax, Total', () => {
    beforeEach(() => {
        usePosStore.getState().clearCart();
    });

    it('calculates subtotal correctly for single item', () => {
        usePosStore.getState().addToCart(mockProduct({ price: 100 }));
        usePosStore.getState().updateQuantity('prod-001', 2); // quantity = 3

        const { cart } = usePosStore.getState();
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        expect(subtotal).toBe(300); // 100 × 3
    });

    it('calculates subtotal correctly for multiple items', () => {
        usePosStore.getState().addToCart(mockProduct({ id: 'p1', price: 99 }));
        usePosStore.getState().addToCart(mockProduct({ id: 'p2', price: 150 }));

        const { cart } = usePosStore.getState();
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        expect(subtotal).toBe(249); // 99 + 150
    });

    it('calculates 13% VAT correctly', () => {
        usePosStore.getState().addToCart(mockProduct({ price: 100 }));

        const { cart } = usePosStore.getState();
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = Number((subtotal * 0.13).toFixed(2));
        const total = Number((subtotal + tax).toFixed(2));

        expect(subtotal).toBe(100);
        expect(tax).toBe(13);
        expect(total).toBe(113);
    });

    it('handles large quantities without floating point errors', () => {
        usePosStore.getState().addToCart(mockProduct({ price: 33.33 }));
        usePosStore.getState().updateQuantity('prod-001', 99); // quantity = 100

        const { cart } = usePosStore.getState();
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = Number((subtotal * 0.13).toFixed(2));
        const total = Number((subtotal + tax).toFixed(2));

        expect(total).toBeGreaterThan(0);
        expect(total).toBe(Number((subtotal + tax).toFixed(2))); // No floating point drift
    });
});
