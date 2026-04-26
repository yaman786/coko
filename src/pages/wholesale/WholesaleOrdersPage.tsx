import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wholesaleApi } from '../../services/wholesaleApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
    Search, Plus, Ban, ChevronDown, ChevronUp, 
    Calendar, Clock, User, Pencil, Trash2, Receipt, AlertTriangle, 
    Loader2 
} from 'lucide-react';
import { CreateSupplyOrderDialog } from '../../features/wholesale/components/CreateSupplyOrderDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { WsOrder } from '../../types';

export function WholesaleOrdersPage() {
    usePageTitle('Supply Orders', 'GOD');
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    // CRUD State
    const [editingOrder, setEditingOrder] = useState<WsOrder | null>(null);
    const [deletingOrder, setDeletingOrder] = useState<WsOrder | null>(null);
    const [editStatus, setEditStatus] = useState<string>('');
    const [editPaymentStatus, setEditPaymentStatus] = useState<string>('');
    const [editPaymentMethod, setEditPaymentMethod] = useState<string>('');
    const [editDate, setEditDate] = useState<string>('');

    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['ws_orders'],
        queryFn: () => wholesaleApi.getOrders(500),
        refetchInterval: 30000,
    });

    // Mutations
    const updateMutation = useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: Partial<WsOrder> }) => 
            wholesaleApi.updateOrder(id, updates),
        onSuccess: () => {
            toast.success("Order updated successfully.");
            setEditingOrder(null);
            queryClient.invalidateQueries({ queryKey: ['ws_orders'] });
        },
        onError: (error: any) => toast.error(`Update failed: ${error.message}`)
    });

    const deleteMutation = useMutation({
        mutationFn: (order: WsOrder) => wholesaleApi.deleteOrder(order.id, order.items, order.status),
        onSuccess: () => {
            toast.success("Order deleted permanently and stock restored.");
            setDeletingOrder(null);
            queryClient.invalidateQueries({ queryKey: ['ws_orders'] });
            queryClient.invalidateQueries({ queryKey: ['ws_products'] });
        },
        onError: (error: any) => toast.error(`Delete failed: ${error.message}`)
    });

    const cancelMutation = useMutation({
        mutationFn: ({ id, client_id, items }: { id: string; client_id: string; items: any }) => 
            wholesaleApi.cancelSupplyOrder(id, client_id, items),
        onSuccess: () => {
            toast.success("Order cancelled securely. Inventory and debts restored.");
            queryClient.invalidateQueries({ queryKey: ['ws_orders'] });
            queryClient.invalidateQueries({ queryKey: ['ws_clients'] }); 
            queryClient.invalidateQueries({ queryKey: ['ws_products'] });
        },
        onError: (error: any) => toast.error(`Cancellation failed: ${error.message}`)
    });

    const handleCancelOrder = (order: WsOrder) => {
        if (!window.confirm("CRITICAL WARNING:\n\nAre you absolutely sure you want to cancel this order?\n\nThis will reverse the inventory stock and wipe the generated debt.")) {
            return;
        }
        cancelMutation.mutate({ id: order.id, client_id: order.client_id, items: order.items });
    };

    const openEditModal = (order: WsOrder) => {
        setEditingOrder(order);
        setEditStatus(order.status);
        setEditPaymentStatus(order.payment_status);
        setEditPaymentMethod(order.payment_method);
        setEditDate(new Date(order.created_at).toISOString().split('T')[0]);
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(o => {
            // Search
            const q = searchQuery.toLowerCase();
            const matchesSearch =
                o.client_name.toLowerCase().includes(q) ||
                o.order_number?.toLowerCase().includes(q);
            
            // Status/Payment Status
            const matchesStatus = statusFilter === 'all' 
                ? true 
                : statusFilter === 'cancelled' 
                    ? o.status === 'cancelled'
                    : o.payment_status === statusFilter && o.status !== 'cancelled';
            
            // Date range
            let matchesDate = true;
            if (dateFrom) {
                const orderDate = new Date(o.created_at);
                const from = new Date(dateFrom);
                from.setHours(0, 0, 0, 0);
                if (orderDate < from) matchesDate = false;
            }
            if (dateTo) {
                const orderDate = new Date(o.created_at);
                const to = new Date(dateTo);
                to.setHours(23, 59, 59, 999);
                if (orderDate > to) matchesDate = false;
            }
                    
            return matchesSearch && matchesStatus && matchesDate;
        });
    }, [orders, searchQuery, statusFilter, dateFrom, dateTo]);

    const stats = useMemo(() => {
        const activeOrders = orders.filter(o => o.status !== 'cancelled');
        const totalRevenue = activeOrders.reduce((sum, o) => sum + o.total_amount, 0);
        const totalReceived = activeOrders.reduce((sum, o) => sum + o.paid_amount, 0);
        return {
            revenue: totalRevenue,
            received: totalReceived,
            pending: totalRevenue - totalReceived,
            count: activeOrders.length
        };
    }, [orders]);

    if (isLoading && orders.length === 0) {
        return (
            <div className="flex flex-col h-64 items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
                <p className="text-slate-500 font-medium">Loading GOD ledger...</p>
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
                    <p className="text-sm text-slate-500 font-medium font-['DM_Sans',sans-serif] mt-1">Audit trail for wholesale distribution and credit management.</p>
                </div>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-sky-600 text-white rounded-2xl font-bold text-sm hover:bg-sky-700 transition-all shadow-lg hover:shadow-sky-200 active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    New Supply Order
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-3xl p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Total Revenue</p>
                    <p className="text-2xl font-black text-slate-800 mt-1">Rs. {stats.revenue.toLocaleString()}</p>
                </Card>
                <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-3xl p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Received</p>
                    <p className="text-2xl font-black text-emerald-600 mt-1">Rs. {stats.received.toLocaleString()}</p>
                </Card>
                <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-3xl p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Total Credit</p>
                    <p className={`text-2xl font-black mt-1 ${stats.pending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        Rs. {stats.pending.toLocaleString()}
                    </p>
                </Card>
                <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-3xl p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Volume</p>
                    <p className="text-2xl font-black text-sky-600 mt-1">{stats.count} Orders</p>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Find by client or #order..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-12 bg-white border-slate-200 rounded-2xl focus:ring-sky-500/20"
                    />
                </div>
                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-3 bg-white px-4 rounded-2xl border border-slate-200 h-12">
                        <Calendar className="w-4 h-4 text-sky-600" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="text-xs font-bold text-slate-700 outline-none"
                        />
                        <span className="text-[10px] font-black text-slate-300">TO</span>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="text-xs font-bold text-slate-700 outline-none"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[160px] h-12 rounded-2xl border-slate-200 bg-white font-bold text-xs">
                            <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Records</SelectItem>
                            <SelectItem value="paid">Fully Paid</SelectItem>
                            <SelectItem value="partial">Partial Debt</SelectItem>
                            <SelectItem value="unpaid">Total Debt</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Orders Feed */}
            <div className="space-y-3">
                {filteredOrders.length === 0 ? (
                    <Card className="py-20 text-center border-dashed border-2 border-slate-200 rounded-3xl">
                        <Receipt className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                        <p className="text-slate-500 font-bold">No matching supply orders found</p>
                        <Button variant="link" className="text-sky-600 mt-2" onClick={() => {setSearchQuery(''); setStatusFilter('all'); setDateFrom(''); setDateTo('');}}>Reset Filters</Button>
                    </Card>
                ) : (
                    filteredOrders.map((order) => {
                        const isExpanded = expandedOrderId === order.id;
                        return (
                            <Card key={order.id} className={`overflow-hidden border border-slate-200 transition-all duration-300 ${isExpanded ? 'ring-2 ring-sky-500/10 shadow-lg' : 'hover:shadow-md'}`}>
                                <div 
                                    className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${order.status === 'cancelled' ? 'bg-slate-100 text-slate-400' : 'bg-sky-50 text-sky-600'}`}>
                                            <Receipt className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-black text-slate-800 tracking-tight">{order.client_name}</h3>
                                                <Badge variant="outline" className={`text-[10px] font-bold uppercase ${
                                                    order.status === 'cancelled' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                                    order.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    order.payment_status === 'partial' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}>
                                                    {order.status === 'cancelled' ? 'Cancelled' : order.payment_status}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                                                <span className="flex items-center gap-1.5 font-medium"><Clock className="w-3.5 h-3.5 opacity-50" /> {format(new Date(order.created_at), 'MMM d, yyyy · h:mm a')}</span>
                                                <span className="flex items-center gap-1.5 font-bold text-sky-700/70"><Receipt className="w-3.5 h-3.5 opacity-50" /> {order.order_number || 'No SKU'}</span>
                                                <span className="flex items-center gap-1.5 font-medium"><User className="w-3.5 h-3.5 opacity-50" /> {order.created_by?.split('@')[0] || 'System'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-10 border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100">
                                        <div className="text-right">
                                            <p className={`text-lg font-black tracking-tight ${order.status === 'cancelled' ? 'text-slate-300 line-through' : 'text-slate-800'}`}>
                                                Rs. {order.total_amount.toLocaleString()}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {order.items.length} Product{order.items.length !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl" onClick={(e) => { e.stopPropagation(); openEditModal(order); }}>
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl" onClick={(e) => { e.stopPropagation(); setDeletingOrder(order); }}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                            {order.status !== 'cancelled' && (
                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl" onClick={(e) => { e.stopPropagation(); handleCancelOrder(order); }}>
                                                    <Ban className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <div className="ml-2 text-slate-300">
                                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-5 pb-5 pt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Order Items & Pricing</h4>
                                                <Badge variant="outline" className="bg-white border-slate-200 text-slate-500 font-bold">
                                                    Payment: {order.payment_method?.toUpperCase()}
                                                </Badge>
                                            </div>
                                            <div className="space-y-3">
                                                {order.items.map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between text-sm">
                                                        <div className="flex items-center gap-3">
                                                            <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-600">
                                                                {item.qty}
                                                            </span>
                                                            <span className="font-bold text-slate-700">{item.name}</span>
                                                            <span className="text-slate-400 text-xs">@ Rs. {item.rate}</span>
                                                        </div>
                                                        <span className="font-black text-slate-800">Rs. {item.total.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-5 pt-4 border-t border-slate-200 border-dashed space-y-2">
                                                <div className="flex justify-between text-xs font-bold text-slate-500 px-1">
                                                    <span>Subtotal</span>
                                                    <span>Rs. {order.subtotal.toLocaleString()}</span>
                                                </div>
                                                {order.discount > 0 && (
                                                    <div className="flex justify-between text-xs font-bold text-sky-600 px-1">
                                                        <span>Discount</span>
                                                        <span>- Rs. {order.discount.toLocaleString()}</span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between items-center pt-2 px-1">
                                                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">Final Amount</span>
                                                    <span className="text-xl font-black text-sky-600">Rs. {order.total_amount.toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between items-center pt-2 px-1 text-xs">
                                                    <span className="font-bold text-emerald-600">Amount Received</span>
                                                    <span className="font-black text-emerald-600">Rs. {order.paid_amount.toLocaleString()}</span>
                                                </div>
                                                {order.total_amount > order.paid_amount && (
                                                    <div className="flex justify-between items-center pt-1 px-1 text-xs">
                                                        <span className="font-bold text-amber-600">Timeline Debt</span>
                                                        <span className="font-black text-amber-600">Rs. {(order.total_amount - order.paid_amount).toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {order.notes && (
                                                <div className="mt-4 p-3 bg-white rounded-xl border border-slate-100 text-xs text-slate-500 italic">
                                                    " {order.notes} "
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Edit Modal */}
            <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
                <DialogContent className="rounded-3xl border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-slate-800">Update Order Metadata</DialogTitle>
                        <DialogDescription className="text-slate-500">
                            Adjust administrative details for Order #{editingOrder?.order_number}. Changes here are logged for audit.
                        </DialogDescription>
                    </DialogHeader>
                    {editingOrder && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">General Status</label>
                                <Select value={editStatus} onValueChange={setEditStatus}>
                                    <SelectTrigger className="h-12 rounded-2xl border-slate-200">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="completed">Active Order</SelectItem>
                                        <SelectItem value="cancelled">Cancelled / Void</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Order Date (Backdate)</label>
                                <Input
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="h-12 rounded-2xl border-slate-200 font-bold"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Payment Status</label>
                                    <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                                        <SelectTrigger className="h-12 rounded-2xl border-slate-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="paid">Fully Paid</SelectItem>
                                            <SelectItem value="partial">Partial Payment</SelectItem>
                                            <SelectItem value="unpaid">Unpaid / Debt</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Payment Method</label>
                                    <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                                        <SelectTrigger className="h-12 rounded-2xl border-slate-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Cash Payment</SelectItem>
                                            <SelectItem value="credit">Credit / Timeline</SelectItem>
                                            <SelectItem value="mixed">Mixed Methods</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setEditingOrder(null)} className="rounded-2xl h-11 px-6">Cancel</Button>
                        <Button
                            className="bg-sky-600 hover:bg-sky-700 rounded-2xl h-11 px-6 shadow-lg shadow-sky-100"
                            disabled={updateMutation.isPending}
                            onClick={() => {
                                if (!editingOrder) return;
                                
                                // Check if we are cancelling via edit
                                if (editStatus === 'cancelled' && editingOrder.status !== 'cancelled') {
                                    handleCancelOrder(editingOrder);
                                    setEditingOrder(null);
                                    return;
                                }

                                updateMutation.mutate({
                                    id: editingOrder.id,
                                    updates: {
                                        status: editStatus,
                                        payment_status: editPaymentStatus as any,
                                        payment_method: editPaymentMethod as any,
                                        created_at: new Date(editDate)
                                    }
                                });
                            }}
                        >
                            {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Save Metadata'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deletingOrder} onOpenChange={(open) => !open && setDeletingOrder(null)}>
                <AlertDialogContent className="rounded-3xl border-0 shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-6 h-6" />
                            Permanent Erasure
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            You are about to permanently delete **Order #{deletingOrder?.order_number}** from the GOD database. 
                            This action **cannot be undone** and will not automatically reverse inventory or ledger balances. 
                            <br/><br/>
                            <span className="font-bold text-red-700 italic">For standard reversals, use the "Cancel Order" function instead.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-2xl h-11 px-6 border-slate-200">Keep Order</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white rounded-2xl h-11 px-6"
                            onClick={() => deletingOrder && deleteMutation.mutate(deletingOrder)}
                        >
                            Confirm Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <CreateSupplyOrderDialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
            />
        </div>
    );
}

export default WholesaleOrdersPage;
