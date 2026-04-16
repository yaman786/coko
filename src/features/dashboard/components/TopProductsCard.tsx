import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { TopProduct } from '../../../utils/analytics';

interface TopProductsCardProps {
    title?: string;
    products: TopProduct[];
}

export function TopProductsCard({ title = "Product Performance Board", products }: TopProductsCardProps) {
    return (
        <Card className="col-span-1 lg:col-span-2 bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden flex flex-col h-full hover:shadow-lg transition-all duration-300">
            <CardHeader className="bg-transparent border-b border-slate-100/50 flex-none pb-4 flex flex-row items-center justify-between p-6">
                <div>
                    <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif]">{title}</CardTitle>
                    <CardDescription className="text-sm font-medium text-slate-500 font-['DM_Sans',sans-serif] mt-1">Comprehensive breakdown of product profitability</CardDescription>
                </div>
                <Link to="/analytics/products" className="text-[10px] font-bold font-['DM_Sans',sans-serif] uppercase tracking-wider text-pink-600 hover:text-pink-700 flex items-center gap-1 transition-colors group px-4 py-2 rounded-xl bg-pink-50/50 hover:bg-pink-100/50 border border-pink-100">
                    View Report <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-x-auto">
                <div className="min-w-[800px]">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50/50 border-b border-slate-200/60 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif]">
                            <tr>
                                <th className="px-6 py-4 font-bold tracking-wider">Rank</th>
                                <th className="px-6 py-4 font-bold tracking-wider">Product Name</th>
                                <th className="px-6 py-4 font-bold tracking-wider text-right">Qty Sold</th>
                                <th className="px-6 py-4 font-bold tracking-wider text-right">Gross Rev</th>
                                <th className="px-6 py-4 font-bold tracking-wider text-right">Total Cost</th>
                                <th className="px-6 py-4 font-bold tracking-wider text-right">Gross Profit</th>
                                <th className="px-6 py-4 font-bold tracking-wider text-right">Margin %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        No sales data available yet.
                                    </td>
                                </tr>
                            ) : (
                                products.map((product, index) => {
                                    // Determine margin color
                                    let marginColorBadge = 'bg-slate-100 text-slate-700';
                                    if (product.marginPct >= 60) marginColorBadge = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                                    else if (product.marginPct >= 30) marginColorBadge = 'bg-amber-100 text-amber-700 border-amber-200';
                                    else if (product.marginPct > 0) marginColorBadge = 'bg-red-100 text-red-700 border-red-200';

                                    return (
                                        <tr key={index} className="hover:bg-slate-50/80 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-pink-50 text-pink-600 font-bold text-xs ring-1 ring-pink-500/20 shadow-sm font-['DM_Sans',sans-serif]">
                                                    #{index + 1}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-black text-slate-800 whitespace-nowrap font-['DM_Sans',sans-serif] tracking-tight text-base">
                                                {product.name}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-600 font-['DM_Sans',sans-serif]">
                                                {product.quantity}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-bold text-slate-700 font-['DM_Sans',sans-serif]">Nrs. {product.revenue.toLocaleString()}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-medium text-slate-500 font-['DM_Sans',sans-serif]">Nrs. {product.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-black text-purple-700 font-['DM_Sans',sans-serif]">Nrs. {product.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Badge variant="outline" className={`font-black tracking-tight font-['DM_Sans',sans-serif] ${marginColorBadge}`}>
                                                    {product.marginPct.toFixed(1)}%
                                                </Badge>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}
