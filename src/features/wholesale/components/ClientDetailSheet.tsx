import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { wholesaleApi } from '../../../services/wholesaleApi';
import { X, Pencil, Phone, MapPin, Mail, FileText, Package, Coins, ArrowDownLeft, ArrowUpRight, Trash2 } from 'lucide-react';
import { ClientPricingTable } from './ClientPricingTable';
import { RecordClientPaymentDialog } from './RecordClientPaymentDialog';
import { EditTransactionDialog } from './EditTransactionDialog';
import type { WsClient, WsClientTransaction } from '../../../types';
import { toast } from 'sonner';

interface Props {
    client: WsClient;
    onClose: () => void;
    onEdit: () => void;
}

export function ClientDetailSheet({ client, onClose, onEdit }: Props) {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'details' | 'ledger' | 'reports'>('details');
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingTx, setEditingTx] = useState<WsClientTransaction | null>(null);

    const handleDeleteTransaction = async (tx: WsClientTransaction) => {
        if (!window.confirm(`Are you sure you want to delete this ${tx.type === 'PAYMENT_RECEIVED' ? 'Payment' : 'Order Credit'} of Rs. ${tx.amount}?\n\nThis will automatically reverse the client's total balance to keep it accurate.`)) {
            return;
        }
        try {
            await wholesaleApi.deleteClientTransaction(tx.id, client.id, tx.amount, tx.type as any);
            toast.success("Transaction deleted successfully");
            queryClient.invalidateQueries({ queryKey: ['ws_client_transactions', client.id] });
            queryClient.invalidateQueries({ queryKey: ['ws_clients'] }); 
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete transaction");
        }
    };

    const { data: orders = [] } = useQuery({
        queryKey: ['ws_orders', 'client', client.id],
        queryFn: () => wholesaleApi.getOrdersByClient(client.id),
    });

    const { data: transactions = [] } = useQuery({
        queryKey: ['ws_client_transactions', client.id],
        queryFn: () => wholesaleApi.getClientTransactions(client.id),
    });

    const { data: productInsights = [], isLoading: isLoadingInsights } = useQuery({
        queryKey: ['ws_client_product_analytics', client.id],
        queryFn: () => wholesaleApi.getClientProductAnalytics(client.id),
    });

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white w-full max-w-xl shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">{client.name}</h2>
                        {client.contact_person && (
                            <p className="text-sm text-slate-500">{client.contact_person}</p>
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
                        onClick={() => setActiveTab('reports')}
                        className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'reports' ? 'border-sky-600 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                    >
                        Purchase Report
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 pt-4 space-y-6">
                    {activeTab === 'details' && (
                        <>
                    {/* Balance Card */}
                    <div className={`rounded-xl p-5 ${client.balance > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Outstanding Balance</p>
                        <p className={`text-3xl font-black ${client.balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            Rs. {Math.abs(client.balance).toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
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

                    {/* Recent Orders */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
                            Recent Orders ({orders.length})
                        </h3>
                        {orders.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl">
                                <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                <p className="text-sm font-medium">No orders yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {orders.slice(0, 10).map((order) => (
                                    <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-800">
                                                {order.order_number || 'Order'}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {new Date(order.created_at).toLocaleDateString('en-IN', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-slate-800">
                                                Rs. {order.total_amount?.toLocaleString()}
                                            </p>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                                order.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                                                order.payment_status === 'partial' ? 'bg-amber-100 text-amber-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                                {order.payment_status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                        </>
                    )}

                    {activeTab === 'ledger' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {/* Balance Summary */}
                            <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Balance</p>
                                    <p className={`text-2xl font-black mt-0.5 ${client.balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                        Rs. {Math.abs(client.balance).toLocaleString()}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 font-medium bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                                        {client.balance > 0 ? 'Client owes you' : client.balance < 0 ? 'Advance credit' : 'Account Settled ✓'}
                                    </p>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div className="space-y-3 pt-4">
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Transaction Timeline</h3>
                                {transactions.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                        <FileText className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                                        <p className="text-sm font-semibold text-slate-500">No transactions recorded</p>
                                        <p className="text-xs mt-1">Payments and order credits will appear here.</p>
                                    </div>
                                ) : (
                                    transactions.map(tx => (
                                        <div key={tx.id} className="group flex items-start gap-3.5 p-4 bg-white border border-slate-100 rounded-xl hover:border-slate-200 hover:shadow-sm transition-all shadow-sm">
                                            <div className={`mt-0.5 w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                                tx.type === 'PAYMENT_RECEIVED' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                                            }`}>
                                                {tx.type === 'PAYMENT_RECEIVED' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <p className="text-sm font-bold text-slate-800">
                                                        {tx.type === 'PAYMENT_RECEIVED' ? 'Payment Received' : 'Order Credit Added'}
                                                    </p>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <p className={`text-sm font-bold whitespace-nowrap ${tx.type === 'PAYMENT_RECEIVED' ? 'text-green-600' : 'text-rose-600'}`}>
                                                            {tx.type === 'PAYMENT_RECEIVED' ? '-' : '+'} Rs. {tx.amount.toLocaleString()}
                                                        </p>
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={() => { setEditingTx(tx); setEditDialogOpen(true); }}
                                                                className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors"
                                                                title="Edit Transaction"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteTransaction(tx)}
                                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                                                                title="Delete Transaction"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                                                    <span>{new Date(tx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                    {tx.payment_method && (
                                                        <>
                                                            <span className="text-slate-300">•</span>
                                                            <span className="px-2 py-0.5 bg-slate-100 rounded-md text-slate-600 font-semibold">{tx.payment_method}</span>
                                                        </>
                                                    )}
                                                </div>
                                                {tx.reference_note && (
                                                    <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
                                                        "{tx.reference_note}"
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
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
                                    Download PDF
                                </button>
                            </div>

                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2 mt-6">Top Purchased Products</h3>
                            {isLoadingInsights ? (
                                <div className="text-center py-8 text-slate-400">Crunching analytics...</div>
                            ) : productInsights.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                    <Package className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                                    <p className="text-sm font-semibold text-slate-500">No purchase history</p>
                                    <p className="text-xs mt-1">This client hasn't bought anything yet.</p>
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
                                                    <td className="px-4 py-3">
                                                        <span className="font-semibold text-slate-800">{item.name}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="font-semibold text-slate-600">{Number(item.total_qty).toLocaleString()}</span>
                                                        <span className="text-xs text-slate-400 ml-1">{item.unit}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="font-bold text-slate-800">Rs. {Number(item.total_revenue).toLocaleString()}</span>
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
                    // Balance will be updated globally via query invalidation
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
        </div>
    );
}
