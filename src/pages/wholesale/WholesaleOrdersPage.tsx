import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { wholesaleApi } from '../../services/wholesaleApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Search, Plus, FileText, Ban } from 'lucide-react';
import { CreateSupplyOrderDialog } from '../../features/wholesale/components/CreateSupplyOrderDialog';
import { toast } from 'sonner';

export function WholesaleOrdersPage() {
    usePageTitle('Supply Orders', 'GOD');
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [createOpen, setCreateOpen] = useState(false);

    const handleCancelOrder = async (orderId: string, clientId: string, items: any) => {
        if (!window.confirm("CRITICAL WARNING:\n\nAre you absolutely sure you want to cancel this order?\n\nThis will permanently reverse the inventory stock, delete the generated timeline debt, and wipe the order from the client's purchase history.")) {
            return;
        }

        try {
            await wholesaleApi.cancelSupplyOrder(orderId, clientId, items);
            toast.success("Order cancelled securely. All inventory and ledger debts restored.");
            queryClient.invalidateQueries({ queryKey: ['ws_orders'] });
            queryClient.invalidateQueries({ queryKey: ['ws_clients'] }); 
            queryClient.invalidateQueries({ queryKey: ['ws_client_transactions'] });
            queryClient.invalidateQueries({ queryKey: ['ws_products'] });
        } catch (error) {
            console.error(error);
            toast.error("Failed to cancel order.");
        }
    };

    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['ws_orders'],
        queryFn: () => wholesaleApi.getOrders(200),
    });

    const filteredOrders = useMemo(() =>
        orders.filter(o => {
            const matchesSearch =
                o.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.order_number?.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesStatus = statusFilter === 'all' 
                ? true 
                : statusFilter === 'cancelled' 
                    ? o.status === 'cancelled'
                    : o.payment_status === statusFilter && o.status !== 'cancelled';
                    
            return matchesSearch && matchesStatus;
        }),
        [orders, searchQuery, statusFilter]
    );

    const totalRevenue = useMemo(() =>
        orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.total_amount, 0), [orders]);
    const totalReceived = useMemo(() =>
        orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.paid_amount, 0), [orders]);
    const totalPending = totalRevenue - totalReceived;

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-800 font-['DM_Sans',sans-serif]">
                        Supply <span className="text-sky-600">Orders</span>
                    </h1>
                    <p className="text-sm text-slate-500 font-medium font-['DM_Sans',sans-serif] mt-1">Track all supply deliveries to clients and monitor pending payments</p>
                </div>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl font-semibold text-sm hover:bg-sky-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    New Supply Order
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif]">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-800 tracking-tight font-['DM_Sans',sans-serif]">Rs. {totalRevenue.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif]">Received</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-green-600 tracking-tight font-['DM_Sans',sans-serif]">Rs. {totalReceived.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className={`bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-2xl ${totalPending > 0 ? 'ring-2 ring-amber-500/20' : ''}`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif]">Pending</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-black tracking-tight font-['DM_Sans',sans-serif] ${totalPending > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            Rs. {totalPending.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Search client or order number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-11 bg-white/50 backdrop-blur-sm border-slate-200/60 rounded-full focus:ring-2 focus:ring-sky-500/20 font-medium font-['DM_Sans',sans-serif]"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-11 px-6 rounded-full border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-bold focus:ring-2 focus:ring-sky-500/20 outline-none transition-all cursor-pointer font-['DM_Sans',sans-serif] text-slate-600"
                >
                    <option value="all">All Status</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="unpaid">Unpaid</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            {/* Orders Table */}
            <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif]">
                                <th className="text-left px-4 py-4">Order</th>
                                <th className="text-left px-4 py-4">Client</th>
                                <th className="text-left px-4 py-4">Date</th>
                                <th className="text-center px-4 py-4">Items</th>
                                <th className="text-right px-4 py-4">Total</th>
                                <th className="text-right px-4 py-4">Paid</th>
                                <th className="text-center px-4 py-4">Status</th>
                                <th className="text-right px-4 py-4 w-16"></th>
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
                                    <tr key={order.id} className="border-b border-slate-50 hover:bg-sky-50/30 transition-colors">
                                        <td className="px-4 py-3 font-bold text-sky-700 text-sm">
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
                                        <td className="px-4 py-4 text-center text-sm text-slate-500 font-medium">
                                            {Array.isArray(order.items) ? order.items.length : 0}
                                        </td>
                                        <td className="px-4 py-4 text-right font-black text-slate-800 font-['DM_Sans',sans-serif]">
                                            Rs. {order.total_amount?.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-4 text-right text-sm font-bold text-green-700 font-['DM_Sans',sans-serif]">
                                            Rs. {order.paid_amount?.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {order.status === 'cancelled' ? (
                                                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 uppercase tracking-widest whitespace-nowrap">
                                                    CANCELLED
                                                </span>
                                            ) : (
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                                                    order.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                                                    order.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {order.payment_status?.toUpperCase()}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {order.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => handleCancelOrder(order.id, order.client_id, order.items)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                                    title="Cancel Order & Reverse Database Constraints"
                                                >
                                                    <Ban className="w-4 h-4" />
                                                </button>
                                            )}
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
