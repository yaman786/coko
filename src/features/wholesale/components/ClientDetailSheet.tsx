import { useQuery } from '@tanstack/react-query';
import { wholesaleApi } from '../../../services/wholesaleApi';
import { X, Pencil, Phone, MapPin, Mail, FileText, Package } from 'lucide-react';
import { ClientPricingTable } from './ClientPricingTable';
import type { WsClient } from '../../../types';

interface Props {
    client: WsClient;
    onClose: () => void;
    onEdit: () => void;
}

export function ClientDetailSheet({ client, onClose, onEdit }: Props) {
    const { data: orders = [] } = useQuery({
        queryKey: ['ws_orders', 'client', client.id],
        queryFn: () => wholesaleApi.getOrdersByClient(client.id),
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

                {/* Content */}
                <div className="p-6 space-y-6">
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
                </div>
            </div>
        </div>
    );
}
