import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wholesaleApi } from '../../../services/wholesaleApi';
import { X, Pencil, Phone, MapPin, Mail, FileText, Package, Coins, Trash2, RotateCcw, Ban, AlertTriangle } from 'lucide-react';
import { ClientPricingTable } from './ClientPricingTable';
import { RecordClientPaymentDialog } from './RecordClientPaymentDialog';
import { EditTransactionDialog } from './EditTransactionDialog';
import type { WsClient, WsClientTransaction } from '../../../types';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '../../../components/ui/alert-dialog';

interface Props {
    client: WsClient;
    onClose: () => void;
    onEdit: () => void;
}

export function ClientDetailSheet({ client, onClose, onEdit }: Props) {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'details' | 'ledger' | 'reports' | 'orders'>('details');
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<WsClientTransaction | null>(null);

    const [confirmConfig, setConfirmConfig] = useState<{
        open: boolean;
        title: string;
        description: string;
        action: () => void;
        variant: 'danger' | 'warning' | 'info';
    }>({
        open: false,
        title: '',
        description: '',
        action: () => {},
        variant: 'info'
    });

    const handleDeleteTransaction = async (tx: WsClientTransaction) => {
        setConfirmConfig({
            open: true,
            title: 'Delete Transaction',
            description: `Are you sure you want to delete this ${tx.type === 'PAYMENT_RECEIVED' ? 'Payment' : 'Order Credit'} of Rs. ${tx.amount}? This will automatically reverse the client's total balance.`,
            variant: 'danger',
            action: async () => {
                try {
                    await wholesaleApi.deleteClientTransaction(tx.id, client.id, tx.amount, tx.type as any);
                    toast.success("Transaction deleted successfully");
                    queryClient.invalidateQueries({ queryKey: ['ws_client_transactions', client.id] });
                    queryClient.invalidateQueries({ queryKey: ['ws_clients'] }); 
                } catch (error) {
                    console.error(error);
                    toast.error("Failed to delete transaction");
                }
            }
        });
    };

    const archiveMutation = useMutation({
        mutationFn: () => wholesaleApi.deleteClient(client.id),
        onSuccess: () => {
            toast.success("Client archived successfully");
            queryClient.invalidateQueries({ queryKey: ['ws_clients'] });
            onClose();
        },
        onError: () => toast.error("Failed to archive client")
    });

    const restoreMutation = useMutation({
        mutationFn: () => wholesaleApi.restoreClient(client.id),
        onSuccess: () => {
            toast.success("Client restored successfully");
            queryClient.invalidateQueries({ queryKey: ['ws_clients'] });
            onClose();
        },
        onError: () => toast.error("Failed to restore client")
    });

    const hardDeleteMutation = useMutation({
        mutationFn: () => wholesaleApi.hardDeleteClient(client.id),
        onSuccess: () => {
            toast.success("Client permanently deleted");
            queryClient.invalidateQueries({ queryKey: ['ws_clients'] });
            onClose();
        },
        onError: () => toast.error("Failed to delete client permanently. Check if they have linked orders.")
    });

    const { data: orders = [] } = useQuery({
        queryKey: ['ws_orders', 'client', client.id],
        queryFn: () => wholesaleApi.getOrdersByClient(client.id, client.name),
    });

    const { data: transactions = [] } = useQuery({
        queryKey: ['ws_client_transactions', client.id],
        queryFn: () => wholesaleApi.getClientTransactions(client.id),
    });

    const { data: productInsights = [], isLoading: isLoadingInsights } = useQuery({
        queryKey: ['ws_client_product_analytics', client.id],
        queryFn: () => wholesaleApi.getClientProductAnalytics(client.id),
    });

    // Calculate Running Balance & Totals
    const ledgerData = [...transactions]
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .reduce((acc, tx) => {
            const amount = Number(tx.amount);
            const prevBalance = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0;
            const newBalance = tx.type === 'PAYMENT_RECEIVED' ? prevBalance - amount : prevBalance + amount;
            
            acc.push({
                ...tx,
                runningBalance: newBalance
            });
            return acc;
        }, [] as (WsClientTransaction & { runningBalance: number })[])
        .reverse(); // Show newest first for the table

    const totalBilled = transactions
        .filter(t => t.type === 'ORDER_CREDIT')
        .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const totalCollected = transactions
        .filter(t => t.type === 'PAYMENT_RECEIVED')
        .reduce((sum, t) => sum + Number(t.amount), 0);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white/90 backdrop-blur-2xl w-full max-w-xl shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-white/20">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white/50 backdrop-blur-md border-b border-slate-100 px-6 py-5 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 font-['DM_Sans',sans-serif] tracking-tight">{client.name}</h2>
                        {client.contact_person && (
                            <p className="text-sm text-slate-500 font-medium font-['DM_Sans',sans-serif]">{client.contact_person}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPaymentDialogOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-sky-600 text-white rounded-lg font-bold text-xs hover:bg-sky-700 transition-colors shadow-sm"
                        >
                            <Coins className="w-3.5 h-3.5" />
                            Receive Payment
                        </button>
                        <button
                            onClick={onEdit}
                            className="p-2 rounded-lg hover:bg-sky-50 text-sky-600 transition-colors"
                            title="Edit Client"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        
                        {client.is_active ? (
                            <button 
                                onClick={() => {
                                    setConfirmConfig({
                                        open: true,
                                        title: 'Archive Client',
                                        description: `Archive "${client.name}"? They will be hidden from active lists but their financial history will be preserved.`,
                                        variant: 'warning',
                                        action: () => archiveMutation.mutate()
                                    });
                                }}
                                className="p-2 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
                                title="Archive Client"
                            >
                                <Ban className="w-4 h-4" />
                            </button>
                        ) : (
                            <>
                                <button 
                                    onClick={() => restoreMutation.mutate()}
                                    className="p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                                    title="Restore Client"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => {
                                        setConfirmConfig({
                                            open: true,
                                            title: 'PERMANENT DELETE',
                                            description: `Are you absolutely sure? This will erase "${client.name}" and all their records from the system forever. This action cannot be undone.`,
                                            variant: 'danger',
                                            action: () => hardDeleteMutation.mutate()
                                        });
                                    }}
                                    className="p-2 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors"
                                    title="Hard Delete"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                        
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 px-6 mt-2">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'details' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('ledger')}
                        className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'ledger' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                        Ledger History
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'orders' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                        Order History
                    </button>
                    <button
                        onClick={() => setActiveTab('reports')}
                        className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'reports' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                        Purchase Report
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 pt-4 space-y-6">
                    {activeTab === 'details' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Balance Card */}
                            <div className={`rounded-2xl p-6 shadow-sm border ${client.balance > 0 ? 'bg-amber-50/50 border-amber-200/50' : 'bg-emerald-50/50 border-emerald-200/50'}`}>
                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 font-['DM_Sans',sans-serif] mb-2">Outstanding Balance</p>
                                <p className={`text-4xl font-black font-['DM_Sans',sans-serif] tracking-tighter ${client.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    Rs. {Math.abs(client.balance).toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-500 font-medium mt-2">
                                    {client.balance > 0 ? 'Client owes you' : client.balance < 0 ? 'You owe client (advance)' : 'All settled ✓'}
                                </p>
                            </div>

                            {/* Contact Info */}
                            <div className="space-y-2.5">
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Contact Details</h3>
                                {client.phone && (
                                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                                        <Phone className="w-4 h-4 text-sky-500" />
                                        <span>{client.phone}</span>
                                    </div>
                                )}
                                {client.email && (
                                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                                        <Mail className="w-4 h-4 text-sky-500" />
                                        <span>{client.email}</span>
                                    </div>
                                )}
                                {client.address && (
                                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                                        <MapPin className="w-4 h-4 text-sky-500" />
                                        <span>{client.address}{client.city ? `, ${client.city}` : ''}</span>
                                    </div>
                                )}
                                {client.notes && (
                                    <div className="flex items-start gap-2.5 text-sm text-slate-600">
                                        <FileText className="w-4 h-4 text-sky-500 mt-0.5" />
                                        <span>{client.notes}</span>
                                    </div>
                                )}
                            </div>

                            {/* Custom Pricing */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Custom Pricing</h3>
                                <ClientPricingTable clientId={client.id} />
                            </div>

                            {/* Recent Orders Snippet */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Recent Orders</h3>
                                    {orders.length > 5 && (
                                        <button 
                                            onClick={() => setActiveTab('orders')}
                                            className="text-[10px] font-bold uppercase tracking-widest text-sky-600 hover:text-sky-700 transition-colors"
                                        >
                                            View All →
                                        </button>
                                    )}
                                </div>
                                {orders.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No orders recorded yet.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {orders.slice(0, 5).map((order) => (
                                            <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-transparent hover:border-slate-200 transition-all">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                                        {order.order_number || 'Order'}
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                            order.status === 'cancelled' ? 'bg-slate-200 text-slate-600' :
                                                            order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                                                            'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {order.status === 'cancelled' ? 'Cancelled' : order.payment_status}
                                                        </span>
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                                                            day: 'numeric', month: 'short', year: 'numeric'
                                                        })}
                                                    </p>
                                                </div>
                                                <div className="text-right text-sm font-bold text-slate-800">
                                                    Rs. {order.total_amount?.toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'orders' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Full Order History ({orders.length})</h3>
                            </div>

                            {orders.length === 0 ? (
                                <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                                    <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                                    <p className="text-slate-500 font-bold tracking-tight">No orders recorded yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {orders.map((order) => (
                                        <div key={order.id} className={`p-4 rounded-2xl border transition-all ${order.status === 'cancelled' ? 'bg-slate-50/50 border-slate-100 grayscale opacity-75' : 'bg-white border-slate-100 hover:border-sky-200 shadow-sm'}`}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${order.status === 'cancelled' ? 'bg-slate-100 text-slate-400' : 'bg-sky-50 text-sky-600'}`}>
                                                        <Package className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-800">{order.order_number || 'Supply Order'}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-base font-black tracking-tight ${order.status === 'cancelled' ? 'text-slate-400' : 'text-slate-800'}`}>Rs. {order.total_amount.toLocaleString()}</p>
                                                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                                        order.status === 'cancelled' ? 'bg-slate-100 text-slate-500' :
                                                        order.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600' :
                                                        'bg-amber-50 text-amber-600'
                                                    }`}>
                                                        {order.status === 'cancelled' ? 'Cancelled' : order.payment_status}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-50">
                                                {order.items.slice(0, 4).map((item, idx) => (
                                                    <div key={idx} className="text-[11px] text-slate-500 font-medium flex justify-between">
                                                        <span className="truncate mr-2">• {item.name}</span>
                                                        <span className="whitespace-nowrap font-bold">x{item.qty}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'ledger' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Billed</p>
                                    <p className="text-xl font-black text-slate-800">Rs. {totalBilled.toLocaleString()}</p>
                                </div>
                                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                    <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest mb-1">Total Collected</p>
                                    <p className="text-xl font-black text-emerald-700">Rs. {totalCollected.toLocaleString()}</p>
                                </div>
                            </div>

                            {/* Statement Table */}
                            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                                <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider">Particulars</th>
                                                <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-right">Debit (Dr)</th>
                                                <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-right">Credit (Cr)</th>
                                                <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-right">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {ledgerData.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                                                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                                        <p className="font-bold">No transactions found</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                ledgerData.map((tx) => (
                                                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors group">
                                                        <td className="px-4 py-3 text-slate-500 font-medium whitespace-nowrap">
                                                            {new Date(tx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-700">
                                                                    {tx.type === 'PAYMENT_RECEIVED' ? 'Payment' : (tx as any).order_number || 'Order Credit'}
                                                                    {tx.payment_method && <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-[9px] text-slate-500 uppercase">{tx.payment_method}</span>}
                                                                </span>
                                                                {tx.reference_note && <span className="text-[10px] text-slate-400 italic truncate max-w-[120px]">{tx.reference_note}</span>}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-rose-600 whitespace-nowrap">
                                                            {tx.type === 'ORDER_CREDIT' ? `Rs. ${tx.amount.toLocaleString()}` : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                                                            {tx.type === 'PAYMENT_RECEIVED' ? `Rs. ${tx.amount.toLocaleString()}` : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <span className="font-black text-slate-800 whitespace-nowrap">
                                                                    Rs. {Math.abs(tx.runningBalance).toLocaleString()}
                                                                </span>
                                                                <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button 
                                                                        onClick={() => { setEditingTx(tx); setEditDialogOpen(true); }}
                                                                        className="p-1 text-slate-400 hover:text-sky-600"
                                                                        title="Edit"
                                                                    >
                                                                        <Pencil className="w-3 h-3" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleDeleteTransaction(tx)}
                                                                        className="p-1 text-slate-400 hover:text-rose-600"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="flex items-center justify-between p-5 bg-sky-50 rounded-xl border border-sky-100">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-sky-600">Lifetime Purchase Value</p>
                                    <p className="text-2xl font-black mt-0.5 text-sky-900">
                                        Rs. {productInsights.reduce((sum, item) => sum + item.total_revenue, 0).toLocaleString()}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => window.print()}
                                    className="flex items-center gap-2 px-3 py-2 bg-white border border-sky-200 text-sky-700 rounded-lg hover:bg-sky-100 transition-colors text-xs font-bold shadow-sm print:hidden"
                                >
                                    <FileText className="w-4 h-4" />
                                    PDF
                                </button>
                            </div>

                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2 mt-6">Top Products</h3>
                            {isLoadingInsights ? (
                                <div className="text-center py-8 text-slate-400">Crunching analytics...</div>
                            ) : productInsights.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                    <p className="text-sm font-semibold text-slate-500">No purchase history</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="text-left px-4 py-3 text-xs font-bold uppercase text-slate-500">Product</th>
                                                <th className="text-right px-4 py-3 text-xs font-bold uppercase text-slate-500">Volume</th>
                                                <th className="text-right px-4 py-3 text-xs font-bold uppercase text-slate-500">Revenue</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {productInsights.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-3 font-semibold text-slate-800">{item.name}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="font-semibold text-slate-600">{Number(item.total_qty).toLocaleString()}</span>
                                                        <span className="text-xs text-slate-400 ml-1">{item.unit}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-800">
                                                        Rs. {Number(item.total_revenue).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            
            <RecordClientPaymentDialog
                open={paymentDialogOpen}
                onOpenChange={setPaymentDialogOpen}
                client={client}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['ws_client_transactions', client.id] });
                    queryClient.invalidateQueries({ queryKey: ['ws_clients'] });
                    queryClient.invalidateQueries({ queryKey: ['ws_orders', 'client', client.id] });
                    queryClient.invalidateQueries({ queryKey: ['ws_client_product_analytics', client.id] });
                }}
            />

            <EditTransactionDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                transaction={editingTx}
                clientId={client.id}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['ws_client_transactions', client.id] });
                    queryClient.invalidateQueries({ queryKey: ['ws_clients'] }); 
                }}
            />

            <AlertDialog open={confirmConfig.open} onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, open }))}>
                <AlertDialogContent className="rounded-3xl border-0 shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className={`flex items-center gap-2 ${
                            confirmConfig.variant === 'danger' ? 'text-rose-600' : 
                            confirmConfig.variant === 'warning' ? 'text-amber-600' : 'text-sky-600'
                        }`}>
                            {confirmConfig.variant === 'danger' ? <AlertTriangle className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                            {confirmConfig.title}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-600 font-medium">
                            {confirmConfig.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-2xl h-11 px-6 border-slate-200 font-semibold">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmConfig.action}
                            className={`rounded-2xl h-11 px-6 font-bold text-white shadow-lg ${
                                confirmConfig.variant === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-100' : 
                                confirmConfig.variant === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-100' : 
                                'bg-sky-600 hover:bg-sky-700 shadow-sky-100'
                            }`}
                        >
                            Confirm Action
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
