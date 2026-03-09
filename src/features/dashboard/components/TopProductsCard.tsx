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
        <Card className="col-span-1 lg:col-span-2 border-t-4 border-t-pink-500 shadow-sm overflow-hidden flex flex-col h-full bg-white">
            <CardHeader className="bg-slate-50 border-b border-slate-100 flex-none pb-4 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl font-bold text-slate-800">{title}</CardTitle>
                    <CardDescription className="text-sm">Comprehensive breakdown of product profitability</CardDescription>
                </div>
                <Link to="/analytics/products" className="text-sm font-medium text-pink-600 hover:text-pink-700 flex items-center gap-1 transition-colors group px-3 py-1.5 rounded-lg hover:bg-pink-50">
                    View Report <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-x-auto">
                <div className="min-w-[800px]">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
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
                                                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-pink-100 text-pink-700 font-bold text-xs ring-1 ring-pink-200 shadow-sm">
                                                    #{index + 1}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-800 whitespace-nowrap">
                                                {product.name}
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium text-slate-600">
                                                {product.quantity}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-semibold text-slate-700">Nrs. {product.revenue.toLocaleString()}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-medium text-slate-500">Nrs. {product.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="font-bold text-purple-700">Nrs. {product.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Badge variant="outline" className={`font-black tracking-tight ${marginColorBadge}`}>
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
