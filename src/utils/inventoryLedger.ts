import { subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import type { AuditLogEntry, Product } from '../types';
import { api } from '../services/api';

export interface DailyLedgerRow {
    date: Date;
    startStock: number;
    addedStock: number;
    soldStock: number;
    endStock: number;
    wacc: number;
}

export interface LedgerAnalytics {
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number;
    totalAdded: number;
    totalSold: number;
}

export async function generateProductLedger(
    product: Product,
    daysBack: number,
    auditLogs: AuditLogEntry[]
): Promise<{ rows: DailyLedgerRow[], analytics: LedgerAnalytics, rawLogs: AuditLogEntry[] }> {
    const endDate = endOfDay(new Date());
    const startDate = startOfDay(subDays(endDate, daysBack - 1));

    // 1. Fetch sales data for this product within the date range
    // We also need sales data *after* the date range up to now to wind back the stock correctly
    const allOrders = await api.getOrdersByDateRange(startDate, endDate);

    // For winding back from "now", we actually need all orders from startDate to NOW
    const ordersSinceStart = await api.getOrdersByDateRange(startDate, new Date());

    // 2. Establish "Initial State" at startDate by winding back from LIVE stock
    // Wind back from "Now" to "StartDate"

    // This is complex. Let's use a simpler, more robust "State Reconstruction" approach:
    // 1. Start from startDate.
    // 2. We need initial stock at startDate.
    //    InitialStock = LiveStock - (TotalAdded since Start) + (TotalSold since Start).

    let totalAddedSinceStart = 0;
    let totalSoldSinceStart = 0;

    ordersSinceStart.forEach(order => {
        order.items.forEach((item: any) => {
            if (item.productId === product.id || item.product_id === product.id) {
                totalSoldSinceStart += item.quantity;
            }
        });
    });

    auditLogs.forEach(log => {
        if (new Date(log.createdAt) >= startDate) {
            if (log.action === 'PRODUCT_RESTOCKED' && log.metadata?.added) {
                totalAddedSinceStart += Number(log.metadata.added);
            } else {
                const addedMatch = log.description.match(/\(\+(\d+)\)/);
                if (addedMatch) totalAddedSinceStart += Number(addedMatch[1]);
            }
        }
    });

    let movingStock = product.stock - totalAddedSinceStart + totalSoldSinceStart;

    // For WACC, winding back is hard. Let's assume the WACC at startDate was
    // either the costPrice of the product before the first restock in the logs,
    // or we just use the first available cost price from history.
    let movingWacc = product.costPrice || 0;
    // Walk backwards through logs to find the first cost price *before* our range
    const logsBeforeStart = auditLogs
        .filter(l => new Date(l.createdAt) < startDate)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    for (const log of logsBeforeStart) {
        if (log.metadata?.newCostPrice) {
            movingWacc = Number(log.metadata.newCostPrice);
            break;
        }
    }

    const rows: DailyLedgerRow[] = [];
    let totalRevenue = 0;
    let totalCost = 0;
    let totalAddedInRange = 0;
    let totalSoldInRange = 0;

    // 3. Move FORWARD from startDate to endDate
    for (let i = 0; i < daysBack; i++) {
        const targetDate = subDays(endDate, (daysBack - 1) - i); // Forward: oldest to newest
        const dayStart = startOfDay(targetDate);
        const dayEnd = endOfDay(targetDate);

        const startStockOfDay = movingStock;

        // Sales for the day
        const dayOrders = allOrders.filter(o => {
            const d = new Date(o.createdAt);
            return isWithinInterval(d, { start: dayStart, end: dayEnd });
        });

        let daySoldQty = 0;
        let dayRevenue = 0;
        let dayCost = 0;

        dayOrders.forEach(order => {
            order.items.forEach((item: any) => {
                if (item.productId === product.id || item.product_id === product.id) {
                    daySoldQty += item.quantity;
                    const itemRev = (item.price * item.quantity);
                    const itemCost = ((item.cost_price || movingWacc) * item.quantity);
                    dayRevenue += itemRev;
                    dayCost += itemCost;
                }
            });
        });

        // Restocks for the day (WACC calculation)
        const dayLogs = auditLogs.filter(log => {
            const d = new Date(log.createdAt);
            return isWithinInterval(d, { start: dayStart, end: dayEnd });
        });

        let dayAddedQty = 0;
        dayLogs.forEach(log => {
            let addedQty = 0;
            if (log.action === 'PRODUCT_RESTOCKED' && log.metadata?.added) {
                addedQty = Number(log.metadata.added);
            } else {
                const addedMatch = log.description.match(/\(\+(\d+)\)/);
                if (addedMatch) addedQty = Number(addedMatch[1]);
            }

            if (addedQty > 0) {
                const newPurchasePrice = Number(log.metadata?.newCostPrice || movingWacc);

                // WACC FORMULA: (CurrentValue + NewValue) / TotalQty
                const currentInventoryValue = movingStock * movingWacc;
                const newPurchaseValue = addedQty * newPurchasePrice;

                movingStock += addedQty;
                movingWacc = (movingStock > 0)
                    ? (currentInventoryValue + newPurchaseValue) / movingStock
                    : newPurchasePrice;

                dayAddedQty += addedQty;
            }
        });

        const endStockOfDay = movingStock - daySoldQty;
        movingStock = endStockOfDay;

        rows.push({
            date: dayStart,
            startStock: startStockOfDay,
            addedStock: dayAddedQty,
            soldStock: daySoldQty,
            endStock: endStockOfDay,
            wacc: movingWacc
        });

        totalRevenue += dayRevenue;
        totalCost += dayCost;
        totalAddedInRange += dayAddedQty;
        totalSoldInRange += daySoldQty;
    }

    const profit = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
        rows: rows.sort((a, b) => b.date.getTime() - a.date.getTime()), // Sort newest first for UI
        analytics: {
            revenue: totalRevenue,
            cost: totalCost,
            profit,
            marginPct,
            totalAdded: totalAddedInRange,
            totalSold: totalSoldInRange
        },
        rawLogs: auditLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    };
}

