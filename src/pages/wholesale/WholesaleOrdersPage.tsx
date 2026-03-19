import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { wholesaleApi } from '../../services/wholesaleApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Search, Plus, FileText } from 'lucide-react';
import { CreateSupplyOrderDialog } from '../../features/wholesale/components/CreateSupplyOrderDialog';

export function WholesaleOrdersPage() {
    usePageTitle('Supply Orders', 'GOD');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [createOpen, setCreateOpen] = useState(false);

    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['ws_orders'],
        queryFn: () => wholesaleApi.getOrders(200),
    });

    const filteredOrders = useMemo(() =>
        orders.filter(o => {
            const matchesSearch =
                o.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.order_number?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' || o.payment_status === statusFilter;
            return matchesSearch && matchesStatus;
        }),
        [orders, searchQuery, statusFilter]
    );

    const totalRevenue = useMemo(() =>
        orders.reduce((sum, o) => sum + o.total_amount, 0), [orders]);
    const totalReceived = useMemo(() =>
        orders.reduce((sum, o) => sum + o.paid_amount, 0), [orders]);
    const totalPending = totalRevenue - totalReceived;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-800">
                        Supply <span className="text-blue-600">Orders</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Track all supply deliveries to clients</p>
                </div>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    New Supply Order
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="border-0 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-800">Rs. {totalRevenue.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Received</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">Rs. {totalReceived.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className={`border-0 shadow-sm ${totalPending > 0 ? 'ring-2 ring-amber-200' : ''}`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${totalPending > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            Rs. {totalPending.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Search by client or order number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-11 bg-white"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm"
                >
                    <option value="all">All Status</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="unpaid">Unpaid</option>
                </select>
            </div>

            {/* Orders Table */}
            <Card className="border-0 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/80">
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Order</th>
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Client</th>
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Date</th>
                                <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Items</th>
                                <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Total</th>
                                <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Paid</th>
                                <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-slate-400">
                                        <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                        <p className="font-semibold">No orders yet</p>
                                        <p className="text-sm mt-1">Create your first supply order</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map(order => (
                                    <tr key={order.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors">
                                        <td className="px-4 py-3 font-bold text-blue-700 text-sm">
                                            {order.order_number || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-semibold text-slate-800">{order.client_name}</span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">
                                            {new Date(order.created_at).toLocaleDateString('en-IN', {
                                                day: 'numeric', month: 'short', year: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-slate-600">
                                            {Array.isArray(order.items) ? order.items.length : 0}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                                            Rs. {order.total_amount?.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-medium text-green-700">
                                            Rs. {order.paid_amount?.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                                order.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                                                order.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                                {order.payment_status?.toUpperCase()}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create Order Dialog */}
            <CreateSupplyOrderDialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
            />
        </div>
    );
}

export default WholesaleOrdersPage;
