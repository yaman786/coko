
import { subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import type { AuditLogEntry, WsProduct } from '../types';
import { wholesaleApi } from '../services/wholesaleApi';

export interface DailyLedgerRow {
    date: Date;
    startStock: number;
    addedStock: number;
    soldStock: number;
    endStock: number;
    wacc: number;
    dayRevenue: number;
    dayCost: number;
    dayProfit: number;
}

export interface LedgerAnalytics {
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number;
    totalAdded: number;
    totalSold: number;
    stockVariance: number; // Difference between calculated end stock and live stock
}

export async function generateWholesaleProductLedger(
    product: WsProduct,
    daysBack: number,
    auditLogs: AuditLogEntry[]
): Promise<{ rows: DailyLedgerRow[], analytics: LedgerAnalytics, rawLogs: AuditLogEntry[] }> {
    const endDate = endOfDay(new Date());
    const startDate = startOfDay(subDays(endDate, daysBack - 1));

    // Fetch all wholesale orders (we filter by date range in memory)
    const allOrdersRaw = await wholesaleApi.getOrders(1000);
    const allOrders = allOrdersRaw.filter(o => o.status !== 'cancelled');

    const logsInRange = auditLogs.filter(l => new Date(l.createdAt) >= startDate);

    // Reconstruct start stock by winding back from the current live stock
    let totalAddedInRange = 0;
    let totalSoldInRange = 0;

    allOrders.forEach(order => {
        const orderDate = new Date(order.created_at);
        if (orderDate >= startDate && orderDate <= endDate) {
            order.items.forEach(item => {
                if (item.product_id === product.id) {
                    totalSoldInRange += item.qty;
                }
            });
        }
    });

    auditLogs.forEach(log => {
        if (new Date(log.createdAt) >= startDate && new Date(log.createdAt) <= endDate) {
            if (log.action === 'PRODUCT_RESTOCKED' && log.metadata?.added) {
                totalAddedInRange += Number(log.metadata.added);
            }
        }
    });

    let movingStock = (product.stock ?? 0) - totalAddedInRange + totalSoldInRange;

    // Seed WACC from the product's base cost price
    let movingWacc = product.cost_price || 0;

    const rows: DailyLedgerRow[] = [];
    let totalRevenue = 0;
    let totalCost = 0;
    let dailyAddedQty = 0;
    let dailySoldQty = 0;

    // Walk forward from startDate to endDate
    for (let i = 0; i < daysBack; i++) {
        const targetDate = subDays(endDate, (daysBack - 1) - i);
        const dayStart = startOfDay(targetDate);
        const dayEnd = endOfDay(targetDate);

        const startStockOfDay = movingStock;

        // --- Day's restocks ---
        const dayLogs = auditLogs.filter(log => {
            const d = new Date(log.createdAt);
            return isWithinInterval(d, { start: dayStart, end: dayEnd });
        });

        let dayAddedQty = 0;
        dayLogs.forEach(log => {
            let addedQty = 0;
            if (log.action === 'PRODUCT_RESTOCKED' && log.metadata?.added) {
                addedQty = Number(log.metadata.added);
            }

            if (addedQty > 0) {
                movingStock += addedQty;
                dayAddedQty += addedQty;
            }
        });

        // --- Day's sales ---
        const dayOrders = allOrders.filter(o => {
            const d = new Date(o.created_at);
            return isWithinInterval(d, { start: dayStart, end: dayEnd });
        });

        let daySoldQty = 0;
        let dayRevenue = 0;
        let dayCost = 0;

        dayOrders.forEach(order => {
            order.items.forEach(item => {
                if (item.product_id === product.id) {
                    daySoldQty += item.qty;
                    // Wholesale Order items have the exact rate sold to the client
                    dayRevenue += item.total;
                    dayCost += movingWacc * item.qty;
                }
            });
        });

        const endStockOfDay = movingStock - daySoldQty;
        movingStock = endStockOfDay;

        const dayProfit = dayRevenue - dayCost;

        rows.push({
            date: dayStart,
            startStock: startStockOfDay,
            addedStock: dayAddedQty,
            soldStock: daySoldQty,
            endStock: endStockOfDay,
            wacc: movingWacc,
            dayRevenue,
            dayCost,
            dayProfit
        });

        totalRevenue += dayRevenue;
        totalCost += dayCost;
        dailyAddedQty += dayAddedQty;
        dailySoldQty += daySoldQty;
    }

    const profit = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    // Stock variance: last calculated endStock vs live product stock
    const lastEndStock = rows.length > 0 ? rows[rows.length - 1].endStock : movingStock;
    const stockVariance = (product.stock ?? 0) - lastEndStock;

    return {
        rows: rows.sort((a, b) => b.date.getTime() - a.date.getTime()),
        analytics: {
            revenue: totalRevenue,
            cost: totalCost,
            profit,
            marginPct,
            totalAdded: dailyAddedQty,
            totalSold: dailySoldQty,
            stockVariance
        },
        rawLogs: logsInRange.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    };
}
