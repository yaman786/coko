import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { supabase } from '../lib/supabase';
import { api } from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import {
    Search, ChevronDown, ChevronUp, Receipt, Clock,
    ShoppingBag, Loader2, Calendar, User, Pencil, Trash2, Tag, Gift
} from 'lucide-react';
import { format } from 'date-fns';

interface OrderItem {
    productId?: string;
    product_id?: string;
    name: string;
    price: number;
    quantity: number;
}

interface Order {
    id: string;
    items: OrderItem[];
    totalAmount: number;
    subtotal: number;
    discount: number;
    loyalty: number;
    vat: number;
    paymentMethod: string;
    cashAmount: number;
    cardAmount: number;
    status: string;
    cashierId?: string;
    cashierName?: string;
    isComplimentary?: boolean;
    complimentaryAmount?: number;
    offerTitle?: string;
    offerAmount?: number;
    createdAt: string;
    updatedAt: string;
}

export function OrdersPage() {
    usePageTitle('Orders');
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    // CRUD State
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

    // Form inputs for editing
    const [editStatus, setEditStatus] = useState<string>('');
    const [editPaymentMethod, setEditPaymentMethod] = useState<string>('');

    // Fetch all orders
    const { data: orders = [], isLoading } = useQuery<Order[]>({
        queryKey: ['allOrders'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('createdAt', { ascending: false })
                .limit(200);
            if (error) throw error;
            return (data || []).map((o: Record<string, unknown>) => ({
                id: o.id as string,
                items: o.items as OrderItem[],
                totalAmount: Number(o.totalAmount || 0),
                subtotal: Number(o.subtotal || o.totalAmount || 0),
                discount: Number(o.discount || 0),
                loyalty: Number(o.loyalty || 0),
                vat: Number(o.vat || 0),
                paymentMethod: (o.paymentMethod || 'Cash') as string,
                cashAmount: Number(o.cashAmount || 0),
                cardAmount: Number(o.cardAmount || 0),
                status: o.status as string,
                cashierId: o.cashierId as string | undefined,
                cashierName: o.cashierName as string | undefined,
                isComplimentary: !!o.isComplimentary,
                complimentaryAmount: Number(o.complimentaryAmount || 0),
                offerTitle: o.offerTitle as string | undefined,
                offerAmount: Number(o.offerAmount || 0),
                createdAt: o.createdAt as string,
                updatedAt: o.updatedAt as string,
            }));
        },
        refetchInterval: 30000,
    });

    // Mutations
    const updateMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<Order> }) => {
            if (!session?.user?.email) throw new Error("Unauthorized");
            await api.updateOrder(id, updates as any, session.user.email, session.user.email.split('@')[0]);
        },
        onSuccess: () => {
            toast.success("Order updated successfully.");
            setEditingOrder(null);
            queryClient.invalidateQueries({ queryKey: ['allOrders'] });
            queryClient.invalidateQueries({ queryKey: ['recentOrders'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
        },
        onError: (error) => toast.error(`Update failed: ${(error as Error).message}`)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            if (!session?.user?.email) throw new Error("Unauthorized");
            await api.deleteOrder(id, session.user.email, session.user.email.split('@')[0]);
        },
        onSuccess: () => {
            toast.success("Order deleted.");
            setDeletingOrderId(null);
            queryClient.invalidateQueries({ queryKey: ['allOrders'] });
            queryClient.invalidateQueries({ queryKey: ['recentOrders'] });
            queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
        },
        onError: (error) => toast.error(`Delete failed: ${(error as Error).message}`)
    });

    // Helper to open Edit Modal
    const openEditModal = (order: Order, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingOrder(order);
        setEditStatus(order.status);
        setEditPaymentMethod(order.paymentMethod);
    };

    const handleSaveEdit = () => {
        if (!editingOrder) return;
        updateMutation.mutate({
            id: editingOrder.id,
            updates: {
                status: editStatus,
                paymentMethod: editPaymentMethod
            }
        });
    };

    // Filter orders
    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            // Search filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchesId = order.id.toLowerCase().includes(q);
                const matchesItem = order.items.some(item =>
                    item.name.toLowerCase().includes(q)
                );
                const matchesCashier = (order.cashierName || order.cashierId || '')
                    .toLowerCase().includes(q);
                if (!matchesId && !matchesItem && !matchesCashier) return false;
            }

            // Date range filter
            if (dateFrom) {
                const orderDate = new Date(order.createdAt);
                const from = new Date(dateFrom);
                from.setHours(0, 0, 0, 0);
                if (orderDate < from) return false;
            }
            if (dateTo) {
                const orderDate = new Date(order.createdAt);
                const to = new Date(dateTo);
                to.setHours(23, 59, 59, 999);
                if (orderDate > to) return false;
            }

            return true;
        });
    }, [orders, searchQuery, dateFrom, dateTo]);

    // Summary stats
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalItems = filteredOrders.reduce((sum, o) =>
        sum + o.items.reduce((s, i) => s + i.quantity, 0),
        0);

    if (isLoading) {
        return (
            <div className="flex flex-col h-full items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <p className="text-gray-500 font-medium">Loading order history...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-4 md:space-y-6 p-4 md:p-6">
            {/* Header */}
            <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900">Order History</h1>
                <p className="text-gray-500 text-sm">Complete record of all transactions.</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3 md:gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{filteredOrders.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue</p>
                    <p className="text-2xl font-black text-purple-700 mt-1">Nrs. {totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Items Sold</p>
                    <p className="text-2xl font-black text-gray-900 mt-1">{totalItems}</p>
                </div>
            </div>

            {/* Filters */}
            <Card className="border-0 shadow-md ring-1 ring-gray-200">
                <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search orders, items, or cashier..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-9 text-sm bg-white"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <input
                                type="date"
                                value={dateFrom}
                                max={dateTo || undefined}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <span className="text-gray-400 text-xs">to</span>
                            <input
                                type="date"
                                value={dateTo}
                                min={dateFrom || undefined}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {filteredOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Receipt className="w-10 h-10 text-gray-300" />
                            <p className="text-gray-500 font-medium">No orders found</p>
                            {(searchQuery || dateFrom || dateTo) && (
                                <button
                                    onClick={() => { setSearchQuery(''); setDateFrom(''); setDateTo(''); }}
                                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                                >
                                    Clear all filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredOrders.map((order) => {
                                const isExpanded = expandedOrderId === order.id;
                                const orderDate = new Date(order.createdAt);

                                return (
                                    <div key={order.id} className="transition-colors hover:bg-gray-50/50">
                                        {/* Order Row */}
                                        <button
                                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                            className="w-full flex items-center justify-between px-6 py-4 text-left"
                                        >
                                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                                <div className="flex-shrink-0 p-2 rounded-lg bg-purple-100">
                                                    <ShoppingBag className="w-4 h-4 text-purple-700" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-sm font-bold text-gray-800">
                                                            Order #{order.id.slice(0, 8)}
                                                        </span>
                                                        <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider h-4 border-none text-white ${order.paymentMethod === 'Cash' ? 'bg-emerald-500' : order.paymentMethod === 'Card' ? 'bg-blue-500' : order.paymentMethod === 'Split' ? 'bg-purple-500' : 'bg-gray-500'}`}>
                                                            {order.paymentMethod || 'Cash'}
                                                        </Badge>
                                                        {order.isComplimentary && (
                                                            <Badge variant="outline" className="text-[10px] h-4 border-none bg-purple-700 text-white font-black uppercase tracking-widest">
                                                                Complimentary
                                                            </Badge>
                                                        )}
                                                        <Badge variant="outline" className={`text-[10px] h-4 border-none text-white ${order.status === 'completed' ? 'bg-gray-400' : order.status === 'refunded' ? 'bg-rose-500' : 'bg-amber-500'}`}>
                                                            {order.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {format(orderDate, 'MMM d, yyyy · h:mm a')}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <User className="w-3 h-3" />
                                                            {order.cashierName || order.cashierId?.split('@')[0] || 'System'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-1 truncate">
                                                        {order.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                                                <div className="text-right">
                                                    <p className={`text-sm font-black ${order.status === 'refunded' ? 'text-gray-400 line-through' : 'text-purple-700'}`}>
                                                        Nrs. {order.totalAmount.toLocaleString()}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 font-medium">
                                                        {order.items.reduce((s, i) => s + i.quantity, 0)} items
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 border-l border-gray-100 pl-3">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-purple-600 rounded-full" onClick={(e) => openEditModal(order, e)}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-full" onClick={(e) => { e.stopPropagation(); setDeletingOrderId(order.id); }}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                    <div className="ml-1 text-gray-400">
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Expanded Detail */}
                                        {isExpanded && (
                                            <div className="px-6 pb-4 pt-0">
                                                <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                                                        Order Details
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {order.items.map((item, idx) => (
                                                            <div key={idx} className="flex items-center justify-between text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="bg-purple-100 text-purple-700 text-xs font-bold px-1.5 py-0.5 rounded">
                                                                        ×{item.quantity}
                                                                    </span>
                                                                    <span className="text-gray-700 font-medium">{item.name}</span>
                                                                </div>
                                                                <span className="text-gray-600 font-semibold">
                                                                    Nrs. {(item.price * item.quantity).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="border-t border-gray-200 mt-4 pt-4 space-y-2">
                                                        <div className="flex justify-between items-center text-xs font-semibold text-gray-500">
                                                            <span>Subtotal</span>
                                                            <span>Nrs. {order.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        </div>
                                                        {order.discount > 0 && (
                                                            <div className="flex justify-between items-center text-xs font-semibold text-amber-600">
                                                                <span>Discount Applied</span>
                                                                <span>- Nrs. {order.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>
                                                        )}
                                                        {order.loyalty > 0 && (
                                                            <div className="flex justify-between items-center text-xs font-semibold text-rose-500">
                                                                <span>Loyalty Points Burned</span>
                                                                <span>- Nrs. {order.loyalty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>
                                                        )}
                                                        {order.vat > 0 && (
                                                            <div className="flex justify-between items-center text-xs font-semibold text-gray-500">
                                                                <span>VAT</span>
                                                                <span>+ Nrs. {order.vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>
                                                        )}
                                                        {(order.complimentaryAmount ?? 0) > 0 && (
                                                            <div className="flex justify-between items-center text-xs font-semibold text-purple-600">
                                                                <span className="flex items-center gap-1">
                                                                    <Gift className="w-3 h-3" />
                                                                    Complimentary
                                                                </span>
                                                                <span>- Nrs. {(order.complimentaryAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>
                                                        )}
                                                        {(order.offerAmount ?? 0) > 0 && (
                                                            <div className="flex justify-between items-center text-xs font-semibold text-purple-600 bg-purple-50 p-1.5 rounded border border-purple-100 mt-1">
                                                                <span className="flex items-center gap-1.5 font-black uppercase tracking-tighter">
                                                                    <Tag className="w-3 h-3" />
                                                                    Offer: {order.offerTitle || 'Store Offer'}
                                                                </span>
                                                                <span className="font-black">- Nrs. {(order.offerAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-200 border-dashed">
                                                            <span className="text-sm font-black uppercase tracking-wider text-purple-700">Grand Total</span>
                                                            <span className="text-xl font-black text-purple-700">
                                                                Nrs. {order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 pt-3 border-t-2 border-slate-200 flex flex-col items-end gap-1">
                                                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Payment Breakdown ({order.paymentMethod})</span>
                                                        <div className="flex gap-4 text-xs font-bold mt-1">
                                                            {order.paymentMethod === 'Split' ? (
                                                                <>
                                                                    <span className="text-emerald-600">Cash: Nrs. {order.cashAmount.toLocaleString()}</span>
                                                                    <span className="text-blue-600">Card: Nrs. {order.cardAmount.toLocaleString()}</span>
                                                                </>
                                                            ) : order.paymentMethod === 'Card' ? (
                                                                <span className="text-blue-600">Card: Nrs. {order.totalAmount.toLocaleString()}</span>
                                                            ) : (
                                                                <span className="text-emerald-600">Cash: Nrs. {order.totalAmount.toLocaleString()}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Modal */}
            <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Order Metadata</DialogTitle>
                        <DialogDescription>
                            Adjust the status or payment method. Financial totals cannot be arbitrary changed; void/refund instead.
                        </DialogDescription>
                    </DialogHeader>
                    {editingOrder && (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Order Status</label>
                                <Select value={editStatus} onValueChange={setEditStatus}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="refunded">Refunded / Voided</SelectItem>
                                        <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700">Payment Method</label>
                                <Select value={editPaymentMethod} onValueChange={setEditPaymentMethod}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Cash">Cash</SelectItem>
                                        <SelectItem value="Card">Card</SelectItem>
                                        <SelectItem value="Split">Split</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingOrder(null)}>Cancel</Button>
                        <Button
                            className="bg-purple-600 hover:bg-purple-700"
                            disabled={updateMutation.isPending}
                            onClick={handleSaveEdit}
                        >
                            {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Modal */}
            <AlertDialog open={!!deletingOrderId} onOpenChange={(open) => !open && setDeletingOrderId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete Order #{deletingOrderId?.slice(0, 8)} from the database.
                            If you just want to reverse the finances, consider Editing the order and setting the status to 'Refunded'.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                            onClick={() => deletingOrderId && deleteMutation.mutate(deletingOrderId)}
                        >
                            Yes, permanently delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}
