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
        <Card className="col-span-1 lg:col-span-2 border-t-4 border-t-purple-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>Latest orders processed through the POS</CardDescription>
                </div>
                <Link to="/orders" className="text-sm font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1 hover:underline">
                    View All <ArrowRight className="w-4 h-4" />
                </Link>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {!orders || orders.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm">No recent transactions.</div>
                    ) : (
                        orders.map((order) => (
                            <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border bg-slate-50/50">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-slate-800">
                                        Order #{order.id}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 -mb-1">
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                                            By: {order.cashierId || order.cashierName || 'System'}
                                        </p>
                                        <Badge variant="outline" className={`text-[9px] font-bold h-4 py-0 px-1.5 border-0 ${order.paymentMethod === 'Cash' ? 'bg-emerald-50 text-emerald-700' : order.paymentMethod === 'Card' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                            {order.paymentMethod || 'Cash'}
                                        </Badge>
                                    </div>
                                    <div className="flex gap-1 text-xs text-slate-600 mt-1">
                                        {order.items.slice(0, 2).map((item, i) => (
                                            <span key={i} className="truncate max-w-[120px]">
                                                {item.quantity}x {item.name}{i === 0 && order.items.length > 1 ? ',' : ''}
                                            </span>
                                        ))}
                                        {order.items.length > 2 && <span>+{order.items.length - 2} more</span>}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className="font-semibold text-slate-800">Nrs. {order.totalAmount.toLocaleString()}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
