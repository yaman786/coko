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
    dayRevenue: number;
    dayCost: number;
    dayProfit: number;
    dayDiscounts: number;
}

export interface LedgerAnalytics {
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number;
    totalAdded: number;
    totalSold: number;
    stockVariance: number; // Difference between calculated end stock and live stock
    totalDiscounts: number;
}

export async function generateProductLedger(
    product: Product,
    daysBack: number,
    auditLogs: AuditLogEntry[]
): Promise<{ rows: DailyLedgerRow[], analytics: LedgerAnalytics, rawLogs: AuditLogEntry[] }> {
    const endDate = endOfDay(new Date());
    const startDate = startOfDay(subDays(endDate, daysBack - 1));

    // FIX #1: Single API call (removed duplicate)
    // FIX #3: Only count completed orders
    const allOrders = (await api.getOrdersByDateRange(startDate, endDate))
        .filter(o => o.status === 'completed');

    // FIX #6: Filter audit logs to date range for raw display (engine uses all for wind-back)
    const logsInRange = auditLogs.filter(l => new Date(l.createdAt) >= startDate);

    // Initial stock reconstruction: wind back from live stock
    let totalAddedSinceStart = 0;
    let totalSoldSinceStart = 0;

    allOrders.forEach(order => {
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
            }
        }
    });

    let movingStock = (product.stock ?? 0) - totalAddedSinceStart + totalSoldSinceStart;

    // Seed WACC from the most recent log before our range, or fall back to product.costPrice
    let movingWacc = product.costPrice || 0;
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
    let totalDiscountsInRange = 0;

    // Walk forward from startDate to endDate
    for (let i = 0; i < daysBack; i++) {
        const targetDate = subDays(endDate, (daysBack - 1) - i);
        const dayStart = startOfDay(targetDate);
        const dayEnd = endOfDay(targetDate);

        const startStockOfDay = movingStock;

        // --- Day's restocks (process BEFORE sales for WACC accuracy) ---
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
                const newPurchasePrice = Number(log.metadata?.newCostPrice || movingWacc);

                // WACC: (CurrentValue + NewValue) / TotalQty
                const currentInventoryValue = movingStock * movingWacc;
                const newPurchaseValue = addedQty * newPurchasePrice;

                movingStock += addedQty;
                movingWacc = (movingStock > 0)
                    ? (currentInventoryValue + newPurchaseValue) / movingStock
                    : newPurchasePrice;

                dayAddedQty += addedQty;
            }
        });

        // --- Day's sales ---
        const dayOrders = allOrders.filter(o => {
            const d = new Date(o.createdAt);
            return isWithinInterval(d, { start: dayStart, end: dayEnd });
        });

        let daySoldQty = 0;
        let dayRevenue = 0;
        let dayCost = 0;
        let dayDiscounts = 0;

        dayOrders.forEach(order => {
            // FIX #2: Apply discount proportion & complimentary logic
            const isComplimentary = order.isComplimentary === true;
            const subtotal = order.subtotal || 0;
            const finalTotal = order.totalAmount ?? (subtotal - (order.discount || 0));
            const discountRatio = (subtotal > 0 && !isComplimentary) ? (finalTotal / subtotal) : 0;

            order.items.forEach((item: any) => {
                if (item.productId === product.id || item.product_id === product.id) {
                    daySoldQty += item.quantity;
                    const rawItemRev = item.price * item.quantity;
                    // Apply proportional discount; complimentary = 0 revenue
                    const itemRev = isComplimentary ? 0 : rawItemRev * discountRatio;
                    const itemDiscounts = rawItemRev - itemRev; // Value given away
                    const itemCost = (item.cost_price || movingWacc) * item.quantity;
                    dayRevenue += itemRev;
                    dayCost += itemCost;
                    dayDiscounts += itemDiscounts;
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
            dayProfit,
            dayDiscounts
        });

        totalRevenue += dayRevenue;
        totalCost += dayCost;
        totalAddedInRange += dayAddedQty;
        totalSoldInRange += daySoldQty;
        totalDiscountsInRange += dayDiscounts;
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
            totalAdded: totalAddedInRange,
            totalSold: totalSoldInRange,
            stockVariance,
            totalDiscounts: totalDiscountsInRange
        },
        // FIX #6: Only show logs within the selected date range
        rawLogs: logsInRange.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    };
}
