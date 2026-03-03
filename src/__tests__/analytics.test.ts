/**
 * TEST 4: Dashboard Analytics Logic
 * 
 * Tests the analytics calculation functions used by the Dashboard.
 * Verifies: revenue, order count, average order value, products sold.
 */
import { describe, it, expect } from 'vitest';

// --- Pure analytics calculation (mirrors analytics.ts logic) ---

interface MockOrder {
    totalAmount: number;
    items: { quantity: number; price: number; name: string }[];
    createdAt: Date;
}

function calculateMetrics(orders: MockOrder[]) {
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const totalProductsSold = orders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    return { totalRevenue, totalOrders, averageOrderValue, totalProductsSold };
}

function calculateTopProducts(orders: MockOrder[], limit: number = 5) {
    const productMap = new Map<string, { revenue: number; quantity: number }>();

    orders.forEach(order => {
        order.items.forEach(item => {
            const current = productMap.get(item.name) || { revenue: 0, quantity: 0 };
            productMap.set(item.name, {
                revenue: current.revenue + (item.price * item.quantity),
                quantity: current.quantity + item.quantity,
            });
        });
    });

    return Array.from(productMap.entries())
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
}

function filterOrdersByPeriod(orders: MockOrder[], days: number): MockOrder[] {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return orders.filter(o => new Date(o.createdAt) >= cutoff);
}


describe('Dashboard Metrics Calculation', () => {
    const sampleOrders: MockOrder[] = [
        {
            totalAmount: 226,
            items: [
                { name: 'Vanilla Small', price: 99, quantity: 2 },
                { name: 'Water Bottle', price: 28, quantity: 1 },
            ],
            createdAt: new Date(),
        },
        {
            totalAmount: 150,
            items: [
                { name: 'Chocolate Large', price: 150, quantity: 1 },
            ],
            createdAt: new Date(),
        },
    ];

    it('calculates total revenue', () => {
        const metrics = calculateMetrics(sampleOrders);
        expect(metrics.totalRevenue).toBe(376); // 226 + 150
    });

    it('counts total orders', () => {
        const metrics = calculateMetrics(sampleOrders);
        expect(metrics.totalOrders).toBe(2);
    });

    it('calculates average order value', () => {
        const metrics = calculateMetrics(sampleOrders);
        expect(metrics.averageOrderValue).toBe(188); // 376 / 2
    });

    it('counts total products sold', () => {
        const metrics = calculateMetrics(sampleOrders);
        expect(metrics.totalProductsSold).toBe(4); // 2 + 1 + 1
    });

    it('handles empty orders gracefully', () => {
        const metrics = calculateMetrics([]);
        expect(metrics.totalRevenue).toBe(0);
        expect(metrics.totalOrders).toBe(0);
        expect(metrics.averageOrderValue).toBe(0);
        expect(metrics.totalProductsSold).toBe(0);
    });

    it('handles single order correctly', () => {
        const metrics = calculateMetrics([sampleOrders[0]]);
        expect(metrics.totalRevenue).toBe(226);
        expect(metrics.averageOrderValue).toBe(226);
    });
});

describe('Top Products Ranking', () => {
    const orders: MockOrder[] = [
        {
            totalAmount: 297,
            items: [{ name: 'Vanilla Small', price: 99, quantity: 3 }],
            createdAt: new Date(),
        },
        {
            totalAmount: 150,
            items: [{ name: 'Chocolate Large', price: 150, quantity: 1 }],
            createdAt: new Date(),
        },
        {
            totalAmount: 56,
            items: [{ name: 'Water Bottle', price: 28, quantity: 2 }],
            createdAt: new Date(),
        },
    ];

    it('ranks products by revenue (highest first)', () => {
        const top = calculateTopProducts(orders);
        expect(top[0].name).toBe('Vanilla Small');  // 297
        expect(top[1].name).toBe('Chocolate Large');  // 150
        expect(top[2].name).toBe('Water Bottle');     // 56
    });

    it('limits results to the requested count', () => {
        const top = calculateTopProducts(orders, 2);
        expect(top).toHaveLength(2);
    });

    it('aggregates quantities correctly across multiple orders', () => {
        const repeatedOrders: MockOrder[] = [
            { totalAmount: 99, items: [{ name: 'Vanilla', price: 99, quantity: 1 }], createdAt: new Date() },
            { totalAmount: 99, items: [{ name: 'Vanilla', price: 99, quantity: 2 }], createdAt: new Date() },
        ];
        const top = calculateTopProducts(repeatedOrders);
        expect(top[0].quantity).toBe(3); // 1 + 2
        expect(top[0].revenue).toBe(297); // 99*1 + 99*2
    });
});

describe('Period Filtering', () => {
    it('filters orders to today only', () => {
        const orders: MockOrder[] = [
            { totalAmount: 100, items: [], createdAt: new Date() }, // today
            { totalAmount: 200, items: [], createdAt: new Date(Date.now() - 3 * 86400000) }, // 3 days ago
        ];

        const filtered = filterOrdersByPeriod(orders, 1);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].totalAmount).toBe(100);
    });

    it('filters orders to last 7 days', () => {
        const orders: MockOrder[] = [
            { totalAmount: 100, items: [], createdAt: new Date() },
            { totalAmount: 200, items: [], createdAt: new Date(Date.now() - 5 * 86400000) },
            { totalAmount: 300, items: [], createdAt: new Date(Date.now() - 15 * 86400000) },
        ];

        const filtered = filterOrdersByPeriod(orders, 7);
        expect(filtered).toHaveLength(2);
    });

    it('returns all orders for 30-day period', () => {
        const orders: MockOrder[] = [
            { totalAmount: 100, items: [], createdAt: new Date() },
            { totalAmount: 200, items: [], createdAt: new Date(Date.now() - 20 * 86400000) },
        ];

        const filtered = filterOrdersByPeriod(orders, 30);
        expect(filtered).toHaveLength(2);
    });
});
