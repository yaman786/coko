import { api } from '../services/api';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';


export interface DashboardMetrics {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    totalProductsSold: number;
    cashTotal: number;
    cardTotal: number; // Renamed from fonepayTotal for broader use
    totalDiscounts: number;
    grossRevenue: number;
    totalOffers: number;
    totalComplimentary: number;
}

export interface RevenueData {
    date: string;
    revenue: number;
    orders: number;
}

export interface TopProduct {
    name: string;
    revenue: number;
    quantity: number;
}

export interface RecentOrder {
    id: string;
    items: {
        productId: string;
        name: string;
        price: number;
        quantity: number;
    }[];
    totalAmount: number;
    subtotal: number;
    discount: number;
    loyalty: number;
    vat: number;
    paymentMethod: 'Cash' | 'Card' | 'Split' | 'Other';
    cashAmount?: number;
    cardAmount?: number;
    status: 'pending' | 'completed' | 'cancelled';
    cashierId?: string;
    cashierName?: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Dashboard Metrics — now accepts a `days` parameter so the
 * period filter (Today/Week/Month) controls ALL stat cards.
 */
export async function getDashboardMetrics(days: number = 30): Promise<DashboardMetrics> {
    const start = startOfDay(subDays(new Date(), days - 1));
    const end = endOfDay(new Date());
    const orders = await api.getOrdersByDateRange(start, end);

    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const totalProductsSold = orders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    const cashTotal = orders.reduce((sum, order) => {
        if (order.paymentMethod === 'Cash') return sum + order.totalAmount;
        if (order.paymentMethod === 'Split') return sum + (order.cashAmount || 0);
        return sum;
    }, 0);

    const cardTotal = orders.reduce((sum, order) => {
        if (order.paymentMethod === 'Card') return sum + order.totalAmount;
        if (order.paymentMethod === 'Split') return sum + (order.cardAmount || 0);
        return sum;
    }, 0);

    const grossRevenue = orders.reduce((sum, order) => sum + order.subtotal, 0);
    const totalDiscounts = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
    const totalOffers = orders.reduce((sum, order) => sum + (order.offerAmount || 0), 0);
    const totalComplimentary = orders.reduce((sum, order) => sum + (order.complimentaryAmount || 0), 0);

    return {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        totalProductsSold,
        cashTotal,
        cardTotal,
        totalDiscounts,
        grossRevenue,
        totalOffers,
        totalComplimentary
    };
}

export async function getRevenueTrend(days: number = 7): Promise<RevenueData[]> {
    const endDate = endOfDay(new Date());
    const startDate = startOfDay(subDays(endDate, days - 1));

    const orders = await api.getOrdersByDateRange(startDate, endDate);
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    return dateRange.map(date => {
        const dateStr = format(date, 'MMM d');
        const dayOrders = orders.filter(order =>
            format(new Date(order.createdAt), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        );

        return {
            date: dateStr,
            revenue: dayOrders.reduce((sum, order) => sum + order.totalAmount, 0),
            orders: dayOrders.length
        };
    });
}

/**
 * Top Products — now accepts a `days` parameter for period filtering.
 */
export async function getTopProducts(limit: number = 5, days: number = 30): Promise<TopProduct[]> {
    const start = startOfDay(subDays(new Date(), days - 1));
    const end = endOfDay(new Date());
    const orders = await api.getOrdersByDateRange(start, end);

    const productMap = new Map<string, { revenue: number, quantity: number }>();

    orders.forEach(order => {
        order.items.forEach(item => {
            const current = productMap.get(item.name) || { revenue: 0, quantity: 0 };
            productMap.set(item.name, {
                revenue: current.revenue + (item.price * item.quantity),
                quantity: current.quantity + item.quantity
            });
        });
    });

    return Array.from(productMap.entries())
        .map(([name, stats]) => ({
            name,
            revenue: stats.revenue,
            quantity: stats.quantity
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
}

export async function getRecentOrders(limit: number = 5): Promise<RecentOrder[]> {
    const orders = await api.getRecentOrders(limit);

    return orders.map(o => ({
        id: o.id,
        items: o.items,
        totalAmount: o.totalAmount,
        status: o.status,
        cashierId: o.cashierId,
        cashierName: o.cashierName,
        createdAt: new Date(o.createdAt),
        updatedAt: new Date(o.updatedAt)
    })) as RecentOrder[];
}
