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
    Loader2, Calendar, User, Pencil, Trash2, Tag, Gift, AlertTriangle, FlaskConical
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
    isWaste?: boolean;
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
    const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);

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
                isWaste: !!o.isWaste,
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

        // If status is changed to cancelled, show confirmation dialog
        if (editStatus === 'cancelled' && editingOrder.status !== 'cancelled') {
            setIsStatusConfirmOpen(true);
            return;
        }

        executeStatusUpdate();
    };

    const executeStatusUpdate = () => {
        if (!editingOrder) return;
        updateMutation.mutate({
            id: editingOrder.id,
            updates: {
                status: editStatus,
                paymentMethod: editPaymentMethod
            }
        });
        setIsStatusConfirmOpen(false);
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

    // Strategic Totals: Exclude Waste from Revenue but show total items including waste
    // IMPORTANT: Exclude CANCELLED orders from all summary totals (case-insensitive check)
    const activeOrders = filteredOrders.filter(o => 
        o.status?.toString().toLowerCase().trim() !== 'cancelled'
    );
    const salesOrders = activeOrders.filter(o => !o.isWaste);
    const wasteOrders = activeOrders.filter(o => o.isWaste);
    const totalRevenue = salesOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalItems = activeOrders.reduce((sum, o) =>
        sum + o.items.reduce((s, i) => s + i.quantity, 0),
        0);

    // Group orders by date for UI grouping
    const groupedOrders = useMemo(() => {
        return filteredOrders.reduce((groups, order) => {
            const dateStr = format(new Date(order.createdAt), 'MMMM d, yyyy');
            if (!groups[dateStr]) {
                groups[dateStr] = [];
            }
            groups[dateStr].push(order);
            return groups;
        }, {} as Record<string, typeof filteredOrders>);
    }, [filteredOrders]);

    if (isLoading) {
        return (
            <div className="flex flex-col h-full items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <p className="text-gray-500 font-medium">Loading order history...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-8 p-6 md:p-10 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black tracking-tight text-slate-800 font-['DM_Sans',sans-serif]">
                        Transaction <span className="text-purple-600">Ledger</span>
                    </h1>
                    <p className="text-slate-500 font-medium font-['DM_Sans',sans-serif] mt-1">Complete record of every retail interaction and spillage event.</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/40 backdrop-blur-3xl rounded-[2rem] border border-slate-200/60 p-6 shadow-xl hover:-translate-y-1 transition-all duration-300 border">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Volume</p>
                    <p className="text-3xl font-black text-slate-800 mt-2 font-['DM_Sans',sans-serif] tracking-tight">{salesOrders.length}</p>
                </div>
                <div className="bg-emerald-50/40 backdrop-blur-3xl rounded-[2rem] border border-emerald-200/60 p-6 shadow-xl hover:-translate-y-1 transition-all duration-300 border">
                    <p className="text-[10px] font-black text-emerald-600/70 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Net Cash</p>
                    <p className="text-3xl font-black text-emerald-600 mt-2 font-['DM_Sans',sans-serif] tracking-tight">Rs. {totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-rose-50/40 backdrop-blur-3xl rounded-[2rem] border border-rose-200/60 p-6 shadow-xl hover:-translate-y-1 transition-all duration-300 border">
                    <p className="text-[10px] font-black text-rose-600/70 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Wastage</p>
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-3xl font-black text-rose-600 font-['DM_Sans',sans-serif] tracking-tight">{wasteOrders.length}</p>
                        <Badge className="bg-rose-100 text-rose-700 border-none text-[10px] h-5 font-black uppercase tracking-tighter">-{wasteOrders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)}</Badge>
                    </div>
                </div>
                <div className="bg-white/40 backdrop-blur-3xl rounded-[2rem] border border-slate-200/60 p-6 shadow-xl hover:-translate-y-1 transition-all duration-300 border">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Unit Flow</p>
                    <p className="text-3xl font-black text-slate-800 mt-2 font-['DM_Sans',sans-serif] tracking-tight">{totalItems}</p>
                </div>
            </div>

            {/* Filters */}
            <Card className="bg-white/40 backdrop-blur-3xl border-slate-200/60 shadow-2xl rounded-[2.5rem] overflow-hidden border">
                <CardHeader className="p-8 pb-4 bg-transparent">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
                        <div className="relative flex-1 max-w-md">
                            <Input
                                placeholder="Find transactions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-12 bg-white/80 backdrop-blur-xl border-slate-200/60 rounded-full focus:ring-4 focus:ring-purple-500/10 font-['DM_Sans',sans-serif] shadow-sm text-sm pl-12 transition-all"
                            />
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <Search className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="flex items-center gap-4 bg-white/50 p-1.5 rounded-full border border-slate-200/60 shadow-inner px-4">
                            <Calendar className="w-4 h-4 text-purple-600" />
                            <input
                                type="date"
                                value={dateFrom}
                                max={dateTo || undefined}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="text-sm bg-transparent font-black tracking-tight text-slate-800 focus:outline-none"
                            />
                            <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest px-1">TO</span>
                            <input
                                type="date"
                                value={dateTo}
                                min={dateFrom || undefined}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="text-sm bg-transparent font-black tracking-tight text-slate-800 focus:outline-none"
                            />
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-0">
                    {filteredOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 gap-4">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center shadow-inner">
                                <Receipt className="w-10 h-10 text-slate-300" />
                            </div>
                            <p className="text-slate-500 font-bold font-['DM_Sans',sans-serif]">Silence in the ledger.</p>
                            {(searchQuery || dateFrom || dateTo) && (
                                <button
                                    onClick={() => { setSearchQuery(''); setDateFrom(''); setDateTo(''); }}
                                    className="text-xs text-purple-600 hover:text-purple-700 font-black uppercase tracking-widest"
                                >
                                    Reset Filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-8 p-6 md:p-8">
                            {Object.entries(groupedOrders).map(([dateStr, ordersForDay]) => (
                                <div key={dateStr} className="space-y-4">
                                    <div className="flex items-center justify-between px-2">
                                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-['DM_Sans',sans-serif] flex items-center gap-3">
                                            <span className="w-8 h-[1px] bg-slate-200"></span>
                                            {dateStr}
                                            <span className="w-8 h-[1px] bg-slate-200"></span>
                                        </h3>
                                        <Badge className="bg-purple-100 text-purple-600 border-none shadow-none font-black text-[10px] px-3">
                                            {ordersForDay.length} {ordersForDay.length === 1 ? 'Entry' : 'Entries'}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        {ordersForDay.map((order, idx) => {
                                            const dailyOrderNumber = ordersForDay.length - idx;
                                            const isExpanded = expandedOrderId === order.id;
                                            const orderDate = new Date(order.createdAt);

                                            return (
                                                <div key={order.id} className="transition-colors hover:bg-gray-50/50">
                                                    {/* Order Row */}
                                                    <button
                                                        onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                                        className="w-full flex items-center justify-between px-4 sm:px-6 py-4 text-left"
                                                    >
                                                        <div className="flex items-center gap-4 min-w-0 flex-1">
                                                            <div className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl border shadow-sm font-black text-xl ${order.isWaste ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-purple-50 border-purple-100 text-purple-700'}`}>
                                                                #{dailyOrderNumber}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                                    <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider h-5 border-none text-white ${order.isWaste ? 'bg-rose-600' : order.paymentMethod === 'Cash' ? 'bg-emerald-500' : order.paymentMethod === 'Card' ? 'bg-blue-500' : order.paymentMethod === 'Split' ? 'bg-purple-500' : 'bg-gray-500'}`}>
                                                                        {order.isWaste ? 'Waste/Spillage' : (order.paymentMethod || 'Cash')}
                                                                    </Badge>
                                                                    {order.isComplimentary && (
                                                                        <Badge variant="outline" className="text-[10px] h-5 border-none bg-purple-700 text-white font-black uppercase tracking-widest">
                                                                            Complimentary
                                                                        </Badge>
                                                                    )}
                                                                    <Badge variant="outline" className={`text-[10px] h-5 border-none text-white ${order.status === 'completed' ? 'bg-gray-400' : order.status === 'cancelled' ? 'bg-rose-500' : 'bg-amber-500'}`}>
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
                                                                <p className={`text-sm font-black ${order.status === 'cancelled' ? 'text-gray-400 line-through' : order.isWaste ? 'text-rose-600' : 'text-purple-700'}`}>
                                                                    {order.isWaste ? 'Rs. 0' : `Nrs. ${order.totalAmount.toLocaleString()}`}
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
                                                            <div className={`rounded-xl border p-4 ${order.isWaste ? 'bg-rose-50 border-rose-100' : 'bg-gray-50 border-gray-200'}`}>
                                                                <div className="flex justify-between items-center mb-3">
                                                                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                                                        {order.isWaste ? 'Spillage reconciliation' : 'Order Details'}
                                                                    </h4>
                                                                    {order.isWaste && (
                                                                        <FlaskConical className="w-4 h-4 text-rose-500 animate-bounce" />
                                                                    )}
                                                                </div>
                                                                <div className="space-y-2">
                                                                    {order.items.map((item, idx) => (
                                                                        <div key={idx} className="flex items-center justify-between text-sm">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`${order.isWaste ? 'bg-rose-100 text-rose-700' : 'bg-purple-100 text-purple-700'} text-xs font-bold px-1.5 py-0.5 rounded`}>
                                                                                    ×{item.quantity}
                                                                                </span>
                                                                                <span className="text-gray-700 font-medium">{item.name}</span>
                                                                            </div>
                                                                            <span className="text-gray-600 font-semibold">
                                                                                {order.isWaste ? 'Wasted' : `Nrs. ${(item.price * item.quantity).toLocaleString()}`}
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
                                                                        <span className={`text-sm font-black uppercase tracking-wider ${order.isWaste ? 'text-rose-700' : 'text-purple-700'}`}>
                                                                            {order.isWaste ? 'Inventory Loss Value' : 'Grand Total'}
                                                                        </span>
                                                                        <span className={`text-xl font-black ${order.isWaste ? 'text-rose-700' : 'text-purple-700'}`}>
                                                                            {order.isWaste ? 'Rs. 0' : `Nrs. ${order.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {!order.isWaste && (
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
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
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
                            Adjust the status or payment method. Financial totals cannot be arbitrary changed; mark as 'Cancelled' instead.
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
                            If you just want to reverse the finances, consider Editing the order and setting the status to 'Cancelled'.
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

            {/* Status Change Confirmation (Cancellation) Modal */}
            <AlertDialog open={isStatusConfirmOpen} onOpenChange={setIsStatusConfirmOpen}>
                <AlertDialogContent className="border-amber-100">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
                            <AlertTriangle className="w-5 h-5" />
                            Confirm Order Cancellation
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            You are about to mark this order as **Cancelled**. This will reverse the revenue calculations but keep the record for audit purposes.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Go Back</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={executeStatusUpdate}
                        >
                            Confirm Cancellation
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </div>
    );
}
