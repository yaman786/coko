/**
 * TEST 3: Input Validation Logic
 * 
 * Tests the validation rules applied to inventory and staff forms.
 * Pure functions — no UI rendering needed.
 */
import { describe, it, expect } from 'vitest';

// --- Inventory Validation (mirrors InventoryTable.tsx → handleSaveItem) ---

interface InventoryFormData {
    name: string;
    price: string;
    stock: string;
    category: string;
}

function validateInventoryForm(formData: InventoryFormData): { valid: boolean; error: string | null } {
    if (!formData.name.trim()) {
        return { valid: false, error: 'Product name is required.' };
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price <= 0) {
        return { valid: false, error: 'Price must be a positive number.' };
    }

    const isBulk = formData.category === 'Scoops';
    const stockVal = parseInt(formData.stock);
    if (!isBulk && (isNaN(stockVal) || stockVal < 0)) {
        return { valid: false, error: 'Stock cannot be negative.' };
    }

    return { valid: true, error: null };
}

// --- Staff Validation (mirrors StaffSection.tsx → handleAddStaff) ---

interface StaffFormData {
    name: string;
    email: string;
    password: string;
}

function validateStaffForm(formData: StaffFormData): { valid: boolean; error: string | null } {
    if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
        return { valid: false, error: 'Name, Email, and Password are required.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        return { valid: false, error: 'Please enter a valid email address.' };
    }

    if (formData.password.length < 6) {
        return { valid: false, error: 'Password must be at least 6 characters.' };
    }

    return { valid: true, error: null };
}


describe('Inventory Form Validation', () => {
    it('passes with valid data', () => {
        const result = validateInventoryForm({ name: 'Water', price: '50', stock: '100', category: 'Bio-products' });
        expect(result.valid).toBe(true);
    });

    it('rejects empty name', () => {
        const result = validateInventoryForm({ name: '', price: '50', stock: '10', category: 'Bio-products' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('name');
    });

    it('rejects whitespace-only name', () => {
        const result = validateInventoryForm({ name: '   ', price: '50', stock: '10', category: 'Bio-products' });
        expect(result.valid).toBe(false);
    });

    it('rejects zero price', () => {
        const result = validateInventoryForm({ name: 'Item', price: '0', stock: '10', category: 'Bio-products' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Price');
    });

    it('rejects negative price', () => {
        const result = validateInventoryForm({ name: 'Item', price: '-10', stock: '10', category: 'Bio-products' });
        expect(result.valid).toBe(false);
    });

    it('rejects non-numeric price', () => {
        const result = validateInventoryForm({ name: 'Item', price: 'abc', stock: '10', category: 'Bio-products' });
        expect(result.valid).toBe(false);
    });

    it('rejects negative stock', () => {
        const result = validateInventoryForm({ name: 'Item', price: '50', stock: '-5', category: 'Bio-products' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Stock');
    });

    it('allows zero stock', () => {
        const result = validateInventoryForm({ name: 'Item', price: '50', stock: '0', category: 'Bio-products' });
        expect(result.valid).toBe(true);
    });

    it('skips stock validation for bulk/Scoops category', () => {
        const result = validateInventoryForm({ name: 'Strawberry Scoop', price: '80', stock: '', category: 'Scoops' });
        expect(result.valid).toBe(true); // Scoops use tub-based stock
    });
});

describe('Staff Form Validation', () => {
    it('passes with valid data', () => {
        const result = validateStaffForm({ name: 'Aman', email: 'aman@coko.com', password: 'secure123' });
        expect(result.valid).toBe(true);
    });

    it('rejects empty name', () => {
        const result = validateStaffForm({ name: '', email: 'a@b.com', password: '123456' });
        expect(result.valid).toBe(false);
    });

    it('rejects empty email', () => {
        const result = validateStaffForm({ name: 'Test', email: '', password: '123456' });
        expect(result.valid).toBe(false);
    });

    it('rejects invalid email format — no @', () => {
        const result = validateStaffForm({ name: 'Test', email: 'notanemail', password: '123456' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('email');
    });

    it('rejects invalid email format — no domain', () => {
        const result = validateStaffForm({ name: 'Test', email: 'user@', password: '123456' });
        expect(result.valid).toBe(false);
    });

    it('rejects password shorter than 6 characters', () => {
        const result = validateStaffForm({ name: 'Test', email: 'a@b.com', password: '123' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('6 characters');
    });

    it('accepts password exactly 6 characters', () => {
        const result = validateStaffForm({ name: 'Test', email: 'a@b.com', password: '123456' });
        expect(result.valid).toBe(true);
    });
});
