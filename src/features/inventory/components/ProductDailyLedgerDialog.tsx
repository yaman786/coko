import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Loader2, TrendingUp, Package, Calendar } from 'lucide-react';
import { generateProductLedger } from '../../../utils/inventoryLedger';
import { api } from '../../../services/api';
import type { Product } from '../../../types';
import { format } from 'date-fns';

interface ProductDailyLedgerDialogProps {
    product: Product | null;
    onClose: () => void;
}

type DateRange = '7' | '30' | '90';

export function ProductDailyLedgerDialog({ product, onClose }: ProductDailyLedgerDialogProps) {
    const [daysBack, setDaysBack] = useState<DateRange>('7');

    const { data, isLoading } = useQuery({
        queryKey: ['productLedger', product?.id, daysBack],
        queryFn: async () => {
            if (!product) return null;
            // Fetch audit logs just for this product
            const auditLogs = await api.getAuditLogsByProduct(product.id || '');
            return await generateProductLedger(product, parseInt(daysBack), auditLogs);
        },
        enabled: !!product
    });

    if (!product) return null;

    return (
        <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[95vw] md:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-slate-50 p-0">
                <DialogHeader className="flex flex-row items-center justify-between p-6 pb-4 border-b border-slate-200">
                    <div>
                        <DialogTitle className="text-2xl font-bold text-slate-800">
                            {product.name}
                        </DialogTitle>
                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                            <span className="font-medium text-slate-700">Live Stock:</span> {product.stock}
                            <span className="text-slate-300">|</span>
                            <span className="font-medium text-slate-700">Live Cost (WACC):</span> Nrs. {product.costPrice?.toFixed(2) || 0}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-slate-200 shadow-sm mr-6">
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
                </DialogHeader>

                {isLoading || !data ? (
                    <div className="flex flex-col items-center justify-center p-12 flex-1">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
                        <p className="text-slate-500 font-medium">Crunching daily ledger...</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto px-6 space-y-6 pb-6 overflow-x-hidden">
                        {/* Top Analytics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Total Revenue</p>
                                <p className="text-lg font-bold text-slate-800">Nrs. {data.analytics.revenue.toLocaleString()}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Total Cost</p>
                                <p className="text-lg font-bold text-slate-800">Nrs. {data.analytics.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                                    Gross Profit <TrendingUp className="w-3 h-3 text-emerald-500" />
                                </p>
                                <div className="flex items-center gap-2">
                                    <p className="text-lg font-bold text-purple-700">Nrs. {data.analytics.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                                    <Badge variant="outline" className={`text-[10px] font-bold ml-auto px-1 ${data.analytics.marginPct >= 60 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                                        {data.analytics.marginPct.toFixed(1)}%
                                    </Badge>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1 flex items-center gap-1">
                                    Movement <Package className="w-3 h-3" />
                                </p>
                                <div className="flex flex-col gap-0.5 text-xs font-medium">
                                    <span className="text-emerald-600">+{data.analytics.totalAdded} Add</span>
                                    <span className="text-red-500">-{data.analytics.totalSold} Sold</span>
                                </div>
                            </div>
                        </div>

                        {/* Daily Ledger Table */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full">
                            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="font-semibold text-slate-800">Daily Stock Movement</h3>
                            </div>
                            <div className="w-full">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="font-bold text-xs p-2">Date</TableHead>
                                            <TableHead className="font-bold text-right text-xs p-2">Start</TableHead>
                                            <TableHead className="font-bold text-right text-emerald-600 text-xs p-2">Added</TableHead>
                                            <TableHead className="font-bold text-right text-red-500 text-xs p-2">Sold</TableHead>
                                            <TableHead className="font-bold text-right bg-slate-50/80 text-xs p-2">End</TableHead>
                                            <TableHead className="font-bold text-right text-xs p-2" title="Weighted Average Cost of Capital (Moving Average)">Unit Cost (WACC)</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.rows.map((row, i) => (
                                            <TableRow key={i} className="hover:bg-slate-50/50">
                                                <TableCell className="text-xs text-slate-700 py-2">
                                                    {format(row.date, 'MMM d, yy')}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-600 text-xs py-2">
                                                    {row.startStock}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-emerald-600 text-xs py-2">
                                                    {row.addedStock > 0 ? `+${row.addedStock}` : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-red-500 text-xs py-2">
                                                    {row.soldStock > 0 ? `-${row.soldStock}` : '-'}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-slate-800 bg-slate-50/50 border-x border-slate-100 text-xs py-2">
                                                    {row.endStock}
                                                </TableCell>
                                                <TableCell className="text-right text-slate-600 font-medium text-xs py-2">
                                                    Nrs. {row.wacc?.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Raw Audit Logs */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6 w-full">
                            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">Raw Audit Trace</h3>
                            </div>
                            <div className="p-0 max-h-48 overflow-y-auto w-full">
                                <table className="w-full text-[10px] text-left table-fixed">
                                    <tbody className="divide-y divide-slate-100">
                                        {data.rawLogs.length === 0 ? (
                                            <tr><td className="p-4 text-center text-slate-400">No logs found.</td></tr>
                                        ) : data.rawLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 text-slate-500 w-[100px]">
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
