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
    id: string;
    name: string;
    revenue: number;
    quantity: number;
    cost: number;
    profit: number;
    marginPct: number;
    revenueDeltaPct?: number;
    quantityDeltaPct?: number;
    profitDeltaPct?: number;
    category?: string;
    parentId?: string;
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
export async function getDashboardMetrics(period: number | { start: Date; end: Date } = 30): Promise<DashboardMetrics> {
    const start = typeof period === 'number' ? startOfDay(subDays(new Date(), period - 1)) : startOfDay(period.start);
    const end = typeof period === 'number' ? endOfDay(new Date()) : endOfDay(period.end);

    console.log(`[Analytics] Fetching Metrics Range: ${format(start, 'yyyy-MM-dd HH:mm:ss')} to ${format(end, 'yyyy-MM-dd HH:mm:ss')}`);
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

export async function getRevenueTrend(period: number | { start: Date; end: Date } = 7): Promise<RevenueData[]> {
    const startDate = typeof period === 'number' ? startOfDay(subDays(endOfDay(new Date()), period - 1)) : startOfDay(period.start);
    const endDate = typeof period === 'number' ? endOfDay(new Date()) : endOfDay(period.end);

    console.log(`[Analytics] Fetching Trend Range: ${format(startDate, 'yyyy-MM-dd HH:mm:ss')} to ${format(endDate, 'yyyy-MM-dd HH:mm:ss')}`);
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

export async function getTopProducts(limit: number = 5, period: number | { start: Date; end: Date } = 30): Promise<TopProduct[]> {
    const start = typeof period === 'number' ? startOfDay(subDays(new Date(), period - 1)) : startOfDay(period.start);
    const end = typeof period === 'number' ? endOfDay(new Date()) : endOfDay(period.end);

    // Calculate previous period dates
    const durationMs = end.getTime() - start.getTime();
    const days = Math.round(durationMs / 86400000) + 1;
    const prevEnd = endOfDay(subDays(start, 1));
    const prevStart = startOfDay(subDays(start, days));

    // Fetch both periods in parallel if possible, or sequentially
    const [rawData, prevRawData] = await Promise.all([
        api.getProductAnalytics(start, end),
        api.getProductAnalytics(prevStart, prevEnd)
    ]);

    // Build a map of previous period data for quick lookup
    const prevDataMap = new Map<string, any>();
    for (const row of prevRawData) {
        prevDataMap.set(row.product_id, row);
    }

    return rawData
        .map((row: any) => {
            const revenue = Number(row.net_revenue) || 0;
            const cost = Number(row.total_cost) || 0;
            const quantity = Number(row.quantity_sold) || 0;
            const profit = revenue - cost;
            const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

            // Calculate Deltas
            const prevRow = prevDataMap.get(row.product_id);
            const prevRevenue = prevRow ? (Number(prevRow.net_revenue) || 0) : 0;
            const prevQuantity = prevRow ? (Number(prevRow.quantity_sold) || 0) : 0;
            const prevCost = prevRow ? (Number(prevRow.total_cost) || 0) : 0;
            const prevProfit = prevRevenue - prevCost;

            const revenueDeltaPct = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : (revenue > 0 ? 100 : 0);
            const quantityDeltaPct = prevQuantity > 0 ? ((quantity - prevQuantity) / prevQuantity) * 100 : (quantity > 0 ? 100 : 0);
            const profitDeltaPct = prevProfit > 0 ? ((profit - prevProfit) / Math.abs(prevProfit)) * 100 : (profit > 0 ? 100 : 0); // Use absolute for previous profit to handle negative to positive swings

            return {
                id: row.product_id,
                name: row.product_name,
                revenue,
                quantity,
                cost,
                profit,
                marginPct,
                revenueDeltaPct,
                quantityDeltaPct,
                profitDeltaPct,
                category: row.category || 'Uncategorized',
                parentId: row.parent_id || null
            };
        })
        .sort((a: any, b: any) => b.profit - a.profit) // Default sort by profit to align with our new UI focus
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
