import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wholesaleApi } from '../../../services/wholesaleApi';
import { useAuth } from '../../../contexts/AuthContext';
import { X, Trash2, ShoppingCart } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { toast } from 'sonner';
import type { WsProduct, WsOrderItem } from '../../../types';

interface Props {
    open: boolean;
    onClose: () => void;
}

interface CartItem extends WsOrderItem {
    autoRate: number;       // client or base rate
    isOverride: boolean;    // user changed the price
    maxStock: number;       // available stock
    qtyStr: string;         // prevents React input bug
    rateStr: string;        // prevents React input bug
}

export function CreateSupplyOrderDialog({ open, onClose }: Props) {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [selectedClientId, setSelectedClientId] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [discount, setDiscount] = useState('0');
    const [paidAmount, setPaidAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit' | 'mixed'>('credit');
    const [notes, setNotes] = useState('');

    const { data: clients = [] } = useQuery({
        queryKey: ['ws_clients'],
        queryFn: wholesaleApi.getClients,
    });

    const { data: products = [] } = useQuery({
        queryKey: ['ws_products'],
        queryFn: wholesaleApi.getActiveProducts,
    });

    const { data: clientPricing = [] } = useQuery({
        queryKey: ['ws_client_pricing', selectedClientId],
        queryFn: () => wholesaleApi.getClientPricing(selectedClientId),
        enabled: !!selectedClientId,
    });

    // When client changes, reset cart and reload pricing
    useEffect(() => {
        setCart([]);
    }, [selectedClientId]);

    const selectedClient = clients.find(c => c.id === selectedClientId);

    // Build a price map for the selected client
    const clientPriceMap = useMemo(() => {
        const map = new Map<string, number>();
        clientPricing.forEach(p => map.set(p.product_id, p.sell_price));
        return map;
    }, [clientPricing]);

    const getEffectiveRate = (product: WsProduct): number => {
        return clientPriceMap.get(product.id) ?? product.base_sell_price;
    };

    const getRateLabel = (product: WsProduct): string => {
        return clientPriceMap.has(product.id) ? 'Client Rate' : 'Base Rate';
    };

    const handleAddProduct = (product: WsProduct) => {
        if (cart.some(c => c.product_id === product.id)) {
            return toast.error('Already in cart');
        }
        const rate = getEffectiveRate(product);
        setCart(prev => [...prev, {
            product_id: product.id,
            name: product.name,
            qty: 1,
            unit: product.unit,
            rate: rate,
            total: rate,
            autoRate: rate,
            isOverride: false,
            maxStock: product.stock,
            qtyStr: '1',
            rateStr: rate.toString(),
        }]);
    };

    const updateCartItemString = (productId: string, field: 'qty' | 'rate', strValue: string) => {
        setCart(prev => prev.map(item => {
            if (item.product_id !== productId) return item;
            
            const numValue = Number(strValue) || 0;
            const updated = { 
                ...item, 
                [`${field}Str`]: strValue,
                [field]: numValue 
            };
            
            if (field === 'rate') {
                updated.isOverride = numValue !== item.autoRate;
            }
            updated.total = updated.qty * updated.rate;
            return updated;
        }));
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.filter(c => c.product_id !== productId));
    };

    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    const discountAmount = Number(discount) || 0;
    const totalAmount = subtotal - discountAmount;
    const paid = Number(paidAmount) || 0;
    const creditAmount = totalAmount - paid;

    const paymentStatus = paid >= totalAmount ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

    const orderMutation = useMutation({
        mutationFn: () => wholesaleApi.processSupplyOrder(
            {
                client_id: selectedClientId,
                client_name: selectedClient?.name || '',
                items: cart.map(({ product_id, name, qty, unit, rate, total }) => ({
                    product_id, name, qty, unit, rate, total,
                })),
                subtotal,
                discount: discountAmount,
                total_amount: totalAmount,
                paid_amount: paid,
                payment_status: paymentStatus as 'paid' | 'partial' | 'unpaid',
                payment_method: paymentMethod,
                notes: notes.trim() || undefined,
                created_by: user?.email || 'admin',
            },
            cart.map(item => ({ product_id: item.product_id, qty: item.qty }))
        ),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ws_products'] });
            queryClient.invalidateQueries({ queryKey: ['ws_clients'] });
            queryClient.invalidateQueries({ queryKey: ['ws_orders'] });
            toast.success('Supply order created!');
            onClose();
        },
        onError: (err) => toast.error('Failed to create order: ' + (err as Error).message),
    });

    const handleSubmit = () => {
        if (!selectedClientId) return toast.error('Select a client');
        if (cart.length === 0) return toast.error('Add at least one product');

        // Check stock
        const overStock = cart.find(item => item.qty > item.maxStock);
        if (overStock) {
            return toast.error(`Not enough stock for ${overStock.name} (available: ${overStock.maxStock})`);
        }

        orderMutation.mutate();
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-sky-600" />
                        Create Supply Order
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Select Client */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Client *</label>
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                        >
                            <option value="">Select a client...</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.name} {c.balance > 0 ? `(Owes Rs.${c.balance.toLocaleString()})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Add Products */}
                    {selectedClientId && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Add Products</label>
                            <select
                                value=""
                                onChange={(e) => {
                                    const product = products.find(p => p.id === e.target.value);
                                    if (product) handleAddProduct(product);
                                }}
                                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                            >
                                <option value="">+ Add a product to order...</option>
                                {products
                                    .filter(p => !cart.some(c => c.product_id === p.id))
                                    .map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.stock} {p.unit} available) — {getRateLabel(p)}: Rs.{getEffectiveRate(p)}
                                        </option>
                                    ))
                                }
                            </select>
                        </div>
                    )}

                    {/* Cart Table */}
                    {cart.length > 0 && (
                        <div className="bg-slate-50 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-left px-3 py-2.5 text-xs font-bold uppercase text-slate-500">Product</th>
                                        <th className="text-center px-3 py-2.5 text-xs font-bold uppercase text-slate-500 w-20">Qty</th>
                                        <th className="text-center px-3 py-2.5 text-xs font-bold uppercase text-slate-500 w-28">Rate</th>
                                        <th className="text-right px-3 py-2.5 text-xs font-bold uppercase text-slate-500 w-24">Total</th>
                                        <th className="w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.map(item => (
                                        <tr key={item.product_id} className="border-b border-slate-100">
                                            <td className="px-3 py-2.5">
                                                <span className="font-medium text-slate-700">{item.name}</span>
                                                <span className="text-xs text-slate-400 ml-1">({item.unit})</span>
                                                {item.isOverride && (
                                                    <span className="text-xs text-amber-600 ml-1.5 font-semibold">Custom</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <Input
                                                    type="number"
                                                    value={item.qtyStr}
                                                    onChange={(e) => updateCartItemString(item.product_id, 'qty', e.target.value)}
                                                    min={1}
                                                    max={item.maxStock}
                                                    className="h-8 text-center text-sm w-full"
                                                />
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <Input
                                                    type="number"
                                                    value={item.rateStr}
                                                    onChange={(e) => updateCartItemString(item.product_id, 'rate', e.target.value)}
                                                    min={0}
                                                    className="h-8 text-center text-sm w-full"
                                                />
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-bold text-slate-800">
                                                Rs. {item.total.toLocaleString()}
                                            </td>
                                            <td className="px-2 py-2.5">
                                                <button
                                                    onClick={() => removeFromCart(item.product_id)}
                                                    className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Totals + Payment */}
                    {cart.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">Subtotal</span>
                                <span className="font-semibold">Rs. {subtotal.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-slate-600 whitespace-nowrap">Discount</span>
                                <Input
                                    type="number"
                                    value={discount}
                                    onChange={(e) => setDiscount(e.target.value)}
                                    className="h-9 text-sm w-28 ml-auto"
                                    min="0"
                                />
                            </div>
                            <div className="flex items-center justify-between text-base font-bold border-t pt-3 border-slate-200">
                                <span>Total</span>
                                <span className="text-sky-700">Rs. {totalAmount.toLocaleString()}</span>
                            </div>

                            <hr className="border-slate-100" />

                            {/* Payment */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Payment</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => {
                                            const method = e.target.value as 'cash' | 'credit' | 'mixed';
                                            setPaymentMethod(method);
                                            if (method === 'cash') setPaidAmount(String(totalAmount));
                                            if (method === 'credit') setPaidAmount('0');
                                        }}
                                        className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm font-bold focus:ring-sky-500 focus:border-sky-500"
                                    >
                                        <option value="cash">Full Cash</option>
                                        <option value="credit">Full Credit (Udhari)</option>
                                        <option value="mixed">Partial Payment</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Paid Amount</label>
                                    <Input
                                        type="number"
                                        value={paidAmount}
                                        onChange={(e) => setPaidAmount(e.target.value)}
                                        className="h-11 focus-visible:ring-sky-500 focus-visible:border-sky-500"
                                        min="0"
                                        max={totalAmount}
                                        disabled={paymentMethod === 'cash' || paymentMethod === 'credit'}
                                    />
                                </div>
                            </div>

                            {/* Credit Preview */}
                            {creditAmount > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                                    <span className="text-amber-800 font-semibold">
                                        Rs. {creditAmount.toLocaleString()} will be added to {selectedClient?.name}'s balance
                                    </span>
                                </div>
                            )}

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes (optional)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Any delivery notes..."
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-sky-500 outline-none resize-none"
                                    rows={2}
                                />
                            </div>

                            {/* Submit */}
                            <button
                                onClick={handleSubmit}
                                disabled={orderMutation.isPending}
                                className="w-full py-3 bg-sky-600 text-white rounded-xl font-bold text-sm hover:bg-sky-700 transition-colors disabled:opacity-50 shadow-sm"
                            >
                                {orderMutation.isPending ? 'Processing...' : `Create Order — Rs. ${totalAmount.toLocaleString()}`}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
