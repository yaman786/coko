import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import type { RecentOrder } from '../../../utils/analytics';
import { Link } from 'react-router-dom';
import { Badge } from '../../../components/ui/badge';

interface RecentOrdersCardProps {
    title?: string;
    orders?: RecentOrder[];
}

export function RecentOrdersCard({ title = "Recent Transactions", orders = [] }: RecentOrdersCardProps) {
    return (
        <Card className="col-span-1 lg:col-span-2 bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100/50 p-6">
                <div>
                    <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif]">{title}</CardTitle>
                    <CardDescription className="text-sm font-medium text-slate-500 font-['DM_Sans',sans-serif] mt-1">Latest orders processed through the POS</CardDescription>
                </div>
                <Link to="/orders" className="text-[10px] font-bold font-['DM_Sans',sans-serif] uppercase tracking-wider text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors group px-4 py-2 rounded-xl bg-purple-50/50 hover:bg-purple-100/50 border border-purple-100">
                    View All <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {!orders || orders.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">No recent transactions.</div>
                    ) : (
                        orders.map((order) => (
                            <div key={order.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white/50 hover:bg-white transition-colors group">
                                <div className="space-y-1">
                                    <p className="text-base font-black text-slate-800 font-['DM_Sans',sans-serif] tracking-tight group-hover:text-purple-600 transition-colors">
                                        Order #{order.id}
                                    </p>
                                    <p className="text-[11px] font-bold text-slate-400 font-['DM_Sans',sans-serif] uppercase tracking-[0.1em]">
                                        {format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}
                                    </p>
                                    <div className="flex items-center gap-2 mt-2 -mb-1">
                                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-bold font-['DM_Sans',sans-serif]">
                                            By: {order.cashierId || order.cashierName || 'System'}
                                        </p>
                                        <Badge variant="outline" className={`text-[9px] font-black tracking-wider uppercase font-['DM_Sans',sans-serif] h-5 py-0 px-2 border-0 ${order.paymentMethod === 'Cash' ? 'bg-emerald-50 text-emerald-700' : order.paymentMethod === 'Card' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                            {order.paymentMethod || 'Cash'}
                                        </Badge>
                                    </div>
                                    <div className="flex gap-1 text-xs font-medium text-slate-500 font-['DM_Sans',sans-serif] mt-1.5">
                                        {order.items.slice(0, 2).map((item, i) => (
                                            <span key={i} className="truncate max-w-[120px]">
                                                {item.quantity}x {item.name}{i === 0 && order.items.length > 1 ? ',' : ''}
                                            </span>
                                        ))}
                                        {order.items.length > 2 && <span>+{order.items.length - 2} more</span>}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className="text-lg font-black text-slate-800 tracking-tight font-['DM_Sans',sans-serif]">Nrs. {order.totalAmount.toLocaleString()}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
