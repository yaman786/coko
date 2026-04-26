import { api } from '../services/api';
import { startOfDay, endOfDay, subDays, eachDayOfInterval, format } from 'date-fns';
import type { Order } from '../types';

/** Comprehensive metrics returned by getDashboardMetrics */
export interface DashboardMetrics {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    totalProductsSold: number;
    cashTotal: number;
    cardTotal: number;
    totalDiscounts: number;
    grossRevenue: number;
    totalOffers: number;
    totalComplimentary: number;
    totalLoyalty: number;
    totalExpenses: number;
    totalCOGS: number;
    wasteValue: number;
    wasteCount: number;
    overYieldValue: number;
    overYieldCount: number;
    trends: {
        revenueDeltaPct: number;
        ordersDeltaPct: number;
        aovDeltaPct: number;
        productsDeltaPct: number;
    };
}

/** A single day's revenue data point for trend charts */
export interface RevenueData {
    date: string;
    revenue: number;
    orders: number;
}

/** Detailed product analytics row */
export interface TopProduct {
    id: string;
    name: string;
    revenue: number;
    quantity: number;
    cost: number;
    profit: number;
    marginPct: number;
    revenueDeltaPct: number;
    quantityDeltaPct: number;
    profitDeltaPct: number;
    category: string;
    parentId: string | null;
    /** @deprecated alias for quantity, kept for backward compatibility */
    sales?: number;
    discounts?: number;
}

/** A recent order summary */
export interface RecentOrder {
    id: string;
    items: Order['items'];
    totalAmount: number;
    status: Order['status'];
    paymentMethod?: Order['paymentMethod'];
    cashierId?: string;
    cashierName?: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Dashboard Metrics — strictly isolated by portal.
 * This prevents Wholesale expenses/orders from leaking into Retail dashboard.
 */
export async function getDashboardMetrics(
    period: number | { start: Date; end: Date } = 30,
    portal: 'retail' | 'wholesale' = 'retail'
): Promise<DashboardMetrics> {
    const start = typeof period === 'number' ? startOfDay(subDays(new Date(), period - 1)) : startOfDay(period.start);
    const end = typeof period === 'number' ? endOfDay(new Date()) : endOfDay(period.end);

    // Calculate previous period dates for trend analysis
    const durationMs = end.getTime() - start.getTime();
    const days = Math.round(durationMs / 86400000) + 1;
    const prevEnd = endOfDay(subDays(start, 1));
    const prevStart = startOfDay(subDays(start, days));

    // 1. Parallel Fetch with strict portal context
    const [orders, prevOrders, expenses, logs] = await Promise.all([
        api.getOrdersByDateRange(start, end, portal),
        api.getOrdersByDateRange(prevStart, prevEnd, portal),
        api.getExpenses(start, end, portal),
        api.getAuditLog(2000) // Audit logs are currently global, we filter them below
    ]);

    // 2. Metric Calculations
    const validOrders = orders.filter(o => !o.isWaste && o.status !== 'cancelled');
    const activeOrders = orders.filter(o => o.status !== 'cancelled');
    
    const totalRevenue = activeOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const totalOrders = validOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Previous Period (for trends)
    const activePrevOrders = prevOrders.filter(o => o.status !== 'cancelled');
    const validPrevOrders = prevOrders.filter(o => !o.isWaste && o.status !== 'cancelled');
    const prevTotalRevenue = activePrevOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
    const prevTotalOrders = validPrevOrders.length;
    const prevAverageOrderValue = prevTotalOrders > 0 ? prevTotalRevenue / prevTotalOrders : 0;

    const totalProductsSold = orders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    const prevTotalProductsSold = prevOrders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    const calculateDelta = (current: number, previous: number) => {
        if (current === 0 && previous === 0) return 0;
        if (previous === 0) return 100;
        return ((current - previous) / previous) * 100;
    };

    const revenueDeltaPct = calculateDelta(totalRevenue, prevTotalRevenue);
    const ordersDeltaPct = calculateDelta(totalOrders, prevTotalOrders);
    const aovDeltaPct = calculateDelta(averageOrderValue, prevAverageOrderValue);
    const productsDeltaPct = calculateDelta(totalProductsSold, prevTotalProductsSold);

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
    const totalLoyalty = orders.reduce((sum, order) => sum + (order.loyalty || 0), 0);

    const totalCOGS = activeOrders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item: any) => {
            const cost = item.costPrice || item.cost_price || 0;
            return itemSum + (cost * item.quantity);
        }, 0);
    }, 0);

    // --- Waste & Over-yield (Portal Filtered) ---
    let posWasteValue = activeOrders.filter(o => o.isWaste).reduce((sum, o) => sum + (o.subtotal || 0), 0);
    let posWasteCount = activeOrders.filter(o => o.isWaste).length;

    let manualWasteValue = 0;
    let manualWasteCount = 0;
    let overYieldValue = 0;
    let overYieldCount = 0;

    // Filter audit logs by portal (only if we can match them via metadata or category)
    logs.forEach(log => {
        const logDate = new Date(log.createdAt);
        if (logDate >= start && logDate <= end && log.action === 'STOCK_ADJUSTMENT') {
            // As a fallback, we assume audit logs without a portal metadata tag belong to retail
            // for backward compatibility, but in new records, we should tag them.
            const logPortal = log.metadata?.portal || 'retail';
            if (logPortal !== portal) return;

            const varianceVal = Number(log.metadata?.variance_value) || 0;
            const type = log.metadata?.variance_type;
            const reason = (log.metadata?.reason as string) || '';

            if (type === 'ASSET_LOSS') {
                const isLossReason = ['Spillage / Shop Damage', 'Melted / Quality Issue', 'Theft / Missing'].includes(reason);
                if (isLossReason) {
                    manualWasteValue += varianceVal;
                    manualWasteCount++;
                }
            } else if (type === 'PROFIT_GAIN') {
                const isGainReason = ['Over-yield Gain'].includes(reason);
                if (isGainReason) {
                    overYieldValue += varianceVal;
                    overYieldCount++;
                }
            }
        }
    });

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
        totalComplimentary,
        totalLoyalty,
        totalExpenses,
        totalCOGS,
        wasteValue: posWasteValue + manualWasteValue,
        wasteCount: posWasteCount + manualWasteCount,
        overYieldValue,
        overYieldCount,
        trends: {
            revenueDeltaPct,
            ordersDeltaPct,
            aovDeltaPct,
            productsDeltaPct
        }
    };
}

export async function getRevenueTrend(
    period: number | { start: Date; end: Date } = 7,
    portal: 'retail' | 'wholesale' = 'retail'
): Promise<RevenueData[]> {
    const startDate = typeof period === 'number' ? startOfDay(subDays(endOfDay(new Date()), period - 1)) : startOfDay(period.start);
    const endDate = typeof period === 'number' ? endOfDay(new Date()) : endOfDay(period.end);

    const orders = await api.getOrdersByDateRange(startDate, endDate, portal);
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    return dateRange.map(date => {
        const dateStr = format(date, 'MMM d');
        const dayOrders = orders.filter(order =>
            format(new Date(order.createdAt), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
        );

        return {
            date: dateStr,
            revenue: dayOrders.reduce((sum, order) => order.status !== 'cancelled' ? sum + order.totalAmount : sum, 0),
            orders: dayOrders.filter(o => o.status !== 'cancelled').length
        };
    });
}

export async function getTopProducts(
    limit: number = 5, 
    period: number | { start: Date; end: Date } = 30,
    portal: 'retail' | 'wholesale' = 'retail'
): Promise<TopProduct[]> {
    const start = typeof period === 'number' ? startOfDay(subDays(new Date(), period - 1)) : startOfDay(period.start);
    const end = typeof period === 'number' ? endOfDay(new Date()) : endOfDay(period.end);

    const durationMs = end.getTime() - start.getTime();
    const days = Math.round(durationMs / 86400000) + 1;
    const prevEnd = endOfDay(subDays(start, 1));
    const prevStart = startOfDay(subDays(start, days));

    const [rawData, prevRawData] = await Promise.all([
        api.getProductAnalytics(start, end, portal),
        api.getProductAnalytics(prevStart, prevEnd, portal)
    ]);

    if (!Array.isArray(rawData)) return [];

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
            const prevRow = prevDataMap.get(row.product_id);
            const prevRevenue = prevRow ? (Number(prevRow.net_revenue) || 0) : 0;
            const prevQuantity = prevRow ? (Number(prevRow.quantity_sold) || 0) : 0;
            const prevCost = prevRow ? (Number(prevRow.total_cost) || 0) : 0;
            const prevProfit = prevRevenue - prevCost;

            return {
                id: row.product_id,
                name: row.product_name,
                revenue,
                quantity,
                cost,
                profit,
                marginPct: revenue > 0 ? (profit / revenue) * 100 : 0,
                revenueDeltaPct: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : (revenue > 0 ? 100 : 0),
                quantityDeltaPct: prevQuantity > 0 ? ((quantity - prevQuantity) / prevQuantity) * 100 : (quantity > 0 ? 100 : 0),
                profitDeltaPct: prevProfit !== 0 ? ((profit - prevProfit) / Math.abs(prevProfit)) * 100 : (profit > 0 ? 100 : 0),
                category: row.category || 'Uncategorized',
                parentId: row.parent_id || null
            };
        })
        .sort((a, b) => b.profit - a.profit)
        .slice(0, limit);
}

export async function getRecentOrders(
    limit: number = 5,
    portal: 'retail' | 'wholesale' = 'retail'
): Promise<RecentOrder[]> {
    const orders = await api.getRecentOrders(limit, portal);

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
