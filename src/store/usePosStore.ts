import { create } from 'zustand';
import type { Product } from '../types';

export interface CartItem extends Product {
    quantity: number;
}

interface PosState {
    cart: CartItem[];
    addToCart: (item: Product) => void;
    updateQuantity: (id: string, delta: number) => void;
    setQuantity: (id: string, qty: number) => void;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
}

export const usePosStore = create<PosState>((set) => ({
    cart: [],

    addToCart: (item) =>
        set((state) => {
            const existingItem = state.cart.find((cartItem) => cartItem.id === item.id);
            if (existingItem) {
                return {
                    cart: state.cart.map((cartItem) =>
                        cartItem.id === item.id
                            ? { ...cartItem, quantity: cartItem.quantity + 1 }
                            : cartItem
                    ),
                };
            }
            return { cart: [...state.cart, { ...item, quantity: 1 }] };
        }),

    updateQuantity: (id, delta) =>
        set((state) => ({
            cart: state.cart
                .map((item) =>
                    item.id === id
                        ? { ...item, quantity: Math.max(0, item.quantity + delta) }
                        : item
                )
                .filter((item) => item.quantity > 0),
        })),

    setQuantity: (id, qty) =>
        set((state) => ({
            cart: state.cart
                .map((item) =>
                    item.id === id
                        ? { ...item, quantity: Math.max(0, qty) }
                        : item
                )
                .filter((item) => item.quantity > 0),
        })),

    removeFromCart: (id) =>
        set((state) => ({
            cart: state.cart.filter((item) => item.id !== id),
        })),

    clearCart: () => set({ cart: [] }),
}));
