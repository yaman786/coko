import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Loader2, TrendingUp, TrendingDown, Package, Calendar, AlertTriangle, BarChart3, Download } from 'lucide-react';
import { generateProductLedger } from '../../../utils/inventoryLedger';
import { api } from '../../../services/api';
import { format } from 'date-fns';
import { exportToCSV } from '../../../utils/export';

interface ProductDailyLedgerDialogProps {
    product: { id: string; name: string } | null;
    onClose: () => void;
}

type DateRange = '7' | '30' | '90';

export function ProductDailyLedgerDialog({ product: productRef, onClose }: ProductDailyLedgerDialogProps) {
    const [daysBack, setDaysBack] = useState<DateRange>('7');

    // FIX #13: Fetch the FULL product object from the database
    const { data: fullProduct } = useQuery({
        queryKey: ['productById', productRef?.id],
        queryFn: () => api.getProductById(productRef!.id),
        enabled: !!productRef?.id
    });

    const { data, isLoading } = useQuery({
        queryKey: ['productLedger', productRef?.id, daysBack, fullProduct?.stock],
        queryFn: async () => {
            if (!fullProduct) return null;
            const auditLogs = await api.getAuditLogsByProduct(fullProduct.id || '');
            return await generateProductLedger(fullProduct, parseInt(daysBack), auditLogs);
        },
        enabled: !!fullProduct
    });

    if (!productRef) return null;

    const handleExportCSV = () => {
        if (!data) return;
        const csvData = data.rows.map((row) => ({
            Date: format(row.date, 'yyyy-MM-dd'),
            'Start Stock': row.startStock,
            Added: row.addedStock,
            Sold: row.soldStock,
            'End Stock': row.endStock,
            'Revenue (Nrs)': row.dayRevenue.toFixed(2),
            'Cost (Nrs)': row.dayCost.toFixed(2),
            'Profit (Nrs)': row.dayProfit.toFixed(2),
            'WACC (Nrs)': row.wacc.toFixed(2)
        }));
        exportToCSV(csvData, `${productRef.name}_ledger_${format(new Date(), 'yyyy-MM-dd')}`);
    };

    return (
        <Dialog open={!!productRef} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[95vw] md:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-slate-50 p-0">
                <DialogHeader className="flex flex-row items-center justify-between p-6 pb-4 border-b border-slate-200">
                    <div>
                        <DialogTitle className="text-2xl font-bold text-slate-800">
                            {productRef.name}
                        </DialogTitle>
                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <span className="font-medium text-slate-700">Live Stock:</span>
                                <span className="font-bold text-slate-900">{fullProduct?.stock ?? '—'}</span>
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="flex items-center gap-1">
                                <span className="font-medium text-slate-700">Live WACC:</span>
                                <span className="font-bold text-slate-900">Nrs. {fullProduct?.costPrice?.toFixed(2) || '—'}</span>
                            </span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2 mr-6">
                        <button
                            onClick={handleExportCSV}
                            disabled={!data}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-sm"
                        >
                            <Download className="w-3.5 h-3.5" />
                            CSV
                        </button>
                        <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                            <Calendar className="w-4 h-4 text-slate-400 ml-2" />
                            <select
                                value={daysBack}
                                onChange={(e) => setDaysBack(e.target.value as DateRange)}
                                className="text-sm border-0 bg-transparent py-1.5 pl-2 pr-6 text-slate-700 focus:ring-0 cursor-pointer font-medium outline-none"
                            >
                                <option value="7">Last 7 Days</option>
                                <option value="30">Last 30 Days</option>
                                <option value="90">Last 90 Days</option>
                            </select>
                        </div>
                    </div>
                </DialogHeader>

                {(isLoading || !data) ? (
                    <div className="flex flex-col items-center justify-center p-12 flex-1">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
                        <p className="text-slate-500 font-medium">Crunching daily ledger...</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto px-6 space-y-5 pb-6 overflow-x-hidden">
                        {/* KPI Strip */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Revenue</p>
                                <p className="text-base font-bold text-slate-800">Nrs. {data.analytics.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Cost</p>
                                <p className="text-base font-bold text-slate-800">Nrs. {data.analytics.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                    Gross Profit {data.analytics.profit >= 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
                                </p>
                                <div className="flex items-center gap-2">
                                    <p className={`text-base font-bold ${data.analytics.profit >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
                                        Nrs. {data.analytics.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </p>
                                    <Badge variant="outline" className={`text-[9px] font-bold px-1.5 ${data.analytics.marginPct >= 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : data.analytics.marginPct > 0 ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : 'bg-red-50 text-red-700 border-red-200'
                                        }`}>
                                        {data.analytics.marginPct.toFixed(1)}%
                                    </Badge>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                    Movement <Package className="w-3 h-3" />
                                </p>
                                <div className="flex items-center gap-3 text-sm font-bold">
                                    <span className="text-emerald-600">+{data.analytics.totalAdded}</span>
                                    <span className="text-red-500">-{data.analytics.totalSold}</span>
                                </div>
                            </div>
                            <div className={`bg-white p-4 rounded-xl border shadow-sm ${data.analytics.stockVariance !== 0 ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'
                                }`}>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                    Variance {data.analytics.stockVariance !== 0 && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                                </p>
                                <p className={`text-base font-bold ${data.analytics.stockVariance === 0 ? 'text-emerald-600' : 'text-amber-600'
                                    }`}>
                                    {data.analytics.stockVariance === 0 ? '✓ Matched' : `${data.analytics.stockVariance > 0 ? '+' : ''}${data.analytics.stockVariance}`}
                                </p>
                            </div>
                        </div>

                        {/* Daily Ledger Table */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full">
                            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-purple-500" />
                                    Daily Stock & Financial Movement
                                </h3>
                            </div>
                            <div className="w-full overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-xs p-2 min-w-[80px]">Date</TableHead>
                                            <TableHead className="font-bold text-center text-xs p-2 whitespace-nowrap">Inventory Flow</TableHead>
                                            <TableHead className="font-bold text-right text-xs p-2" title="Average Selling Price">ASP</TableHead>
                                            <TableHead className="font-bold text-right text-emerald-600 text-xs p-2">Gross Rev</TableHead>
                                            <TableHead className="font-bold text-right text-red-500 text-xs p-2">Given Away</TableHead>
                                            <TableHead className="font-bold text-right text-xs p-2 min-w-[85px]">COGS</TableHead>
                                            <TableHead className="font-bold text-right text-xs p-2 min-w-[85px]">Net Profit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.rows.map((row, i) => {
                                            const isToday = format(row.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                            const asp = row.soldStock > 0 ? row.dayRevenue / row.soldStock : 0;
                                            const marginPct = row.dayRevenue > 0 ? (row.dayProfit / row.dayRevenue) * 100 : 0;

                                            // Ensure dayDiscounts is safe in case of older model
                                            const dayDiscounts = (row as any).dayDiscounts || 0;

                                            return (
                                                <TableRow key={i} className={`hover:bg-slate-50/50 ${isToday ? 'bg-purple-50/30' : ''}`}>
                                                    <TableCell className="text-xs text-slate-700 py-2 font-medium align-top">
                                                        {format(row.date, 'MMM d, yy')}
                                                        {isToday && <span className="ml-1 text-[9px] text-purple-500 font-bold block">TODAY</span>}
                                                    </TableCell>

                                                    {/* Inventory Flow */}
                                                    <TableCell className="text-center py-2 align-middle">
                                                        <div className="inline-flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-100 rounded-md px-2 py-1 text-[11px]">
                                                            <span className="text-slate-500 font-medium" title="Start">{row.startStock}</span>
                                                            <span className="text-slate-300">→</span>
                                                            <span className={`font-bold ${row.addedStock > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                                                {row.addedStock > 0 ? `+${row.addedStock}` : '-'}
                                                            </span>
                                                            <span className="text-slate-300">/</span>
                                                            <span className={`font-bold ${row.soldStock > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                                                                {row.soldStock > 0 ? `-${row.soldStock}` : '-'}
                                                            </span>
                                                            <span className="text-slate-300">→</span>
                                                            <span className="text-slate-800 font-bold" title="End">{row.endStock}</span>
                                                        </div>
                                                    </TableCell>

                                                    {/* ASP */}
                                                    <TableCell className="text-right text-xs py-2 text-slate-600 align-top">
                                                        {asp > 0 ? `Nrs. ${asp.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                                                    </TableCell>

                                                    {/* Gross Rev */}
                                                    <TableCell className="text-right text-xs py-2 font-bold text-slate-800 align-top">
                                                        {row.dayRevenue > 0 ? `Nrs. ${row.dayRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                                                    </TableCell>

                                                    {/* Given Away (Discounts) */}
                                                    <TableCell className={`text-right text-xs py-2 font-medium align-top ${dayDiscounts > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                                                        {dayDiscounts > 0 ? `Nrs. ${dayDiscounts.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                                                    </TableCell>

                                                    {/* COGS & WACC */}
                                                    <TableCell className="text-right py-2 align-top">
                                                        <div className="text-xs text-slate-600">
                                                            {row.dayCost > 0 ? `Nrs. ${row.dayCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                                                        </div>
                                                        <div className="text-[9px] text-slate-400 mt-0.5">
                                                            @ Nrs. {row.wacc.toFixed(0)}/u
                                                        </div>
                                                    </TableCell>

                                                    {/* Net Profit & Margin */}
                                                    <TableCell className="text-right py-2 align-top">
                                                        <div className={`text-xs font-bold ${row.dayProfit > 0 ? 'text-purple-700' : row.dayProfit < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                                            {row.dayProfit !== 0 ? `Nrs. ${row.dayProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                                                        </div>
                                                        {row.dayRevenue > 0 && (
                                                            <div className={`inline-block mt-0.5 px-1 rounded text-[10px] font-mono ${marginPct <= 0 ? 'bg-red-50 text-red-600' : marginPct < 30 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'}`}>
                                                                {marginPct.toFixed(1)}% M
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {/* Totals Row */}
                                        <TableRow className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                                            <TableCell className="text-xs py-2 text-slate-800 align-top">Total</TableCell>

                                            {/* Inventory Flow Totals */}
                                            <TableCell className="text-center py-2 align-middle">
                                                <div className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 shadow-sm rounded-md px-2 py-1 text-[11px]">
                                                    <span className="text-emerald-700 font-bold" title="Total Added">
                                                        +{data.analytics.totalAdded}
                                                    </span>
                                                    <span className="text-slate-300">/</span>
                                                    <span className="text-red-600 font-bold" title="Total Sold">
                                                        -{data.analytics.totalSold}
                                                    </span>
                                                </div>
                                            </TableCell>

                                            {/* ASP Total (Avg) */}
                                            <TableCell className="text-right text-xs py-2 text-slate-600 align-top">
                                                {data.analytics.totalSold > 0 ? `Nrs. ${(data.analytics.revenue / data.analytics.totalSold).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                                            </TableCell>

                                            {/* Rev Total */}
                                            <TableCell className="text-right text-xs py-2 text-slate-800 align-top">
                                                Nrs. {data.analytics.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </TableCell>

                                            {/* Given Away Total */}
                                            <TableCell className={`text-right text-xs py-2 align-top ${((data.analytics as any).totalDiscounts || 0) > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                                Nrs. {((data.analytics as any).totalDiscounts || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </TableCell>

                                            {/* COGS Total */}
                                            <TableCell className="text-right py-2 align-top text-slate-700 text-xs">
                                                Nrs. {data.analytics.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </TableCell>

                                            {/* Profit & Margin Total */}
                                            <TableCell className="text-right py-2 align-top">
                                                <div className={`text-xs font-black ${data.analytics.profit >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
                                                    Nrs. {data.analytics.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </div>
                                                <div className={`inline-block mt-0.5 px-1 rounded text-[10px] font-mono ${data.analytics.marginPct <= 0 ? 'bg-red-50 text-red-600' : data.analytics.marginPct < 30 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'}`}>
                                                    {data.analytics.marginPct.toFixed(1)}% Avg
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Raw Audit Logs */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full">
                            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">Audit Trace ({data.rawLogs.length})</h3>
                            </div>
                            <div className="p-0 max-h-40 overflow-y-auto w-full">
                                <table className="w-full text-[10px] text-left table-fixed">
                                    <tbody className="divide-y divide-slate-100">
                                        {data.rawLogs.length === 0 ? (
                                            <tr><td className="p-4 text-center text-slate-400">No logs in this period.</td></tr>
                                        ) : data.rawLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 text-slate-500 w-[110px]">
                                                    {format(new Date(log.createdAt), 'MMM d, h:mm a')}
                                                </td>
                                                <td className="px-4 py-2 font-medium text-slate-700 truncate">
                                                    {log.description}
                                                </td>
                                                <td className="px-4 py-2 text-slate-400 text-right w-[80px] truncate">
                                                    {log.actor_name || 'System'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
