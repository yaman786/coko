import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wholesaleApi } from '../../../services/wholesaleApi';
import { Plus, Trash2, Save } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { toast } from 'sonner';
import type { WsClientPricing } from '../../../types';

interface Props {
    clientId: string;
}

export function ClientPricingTable({ clientId }: Props) {
    const queryClient = useQueryClient();
    const [addingNew, setAddingNew] = useState(false);
    const [newProductId, setNewProductId] = useState('');
    const [newPrice, setNewPrice] = useState('');

    const { data: pricing = [] } = useQuery({
        queryKey: ['ws_client_pricing', clientId],
        queryFn: () => wholesaleApi.getClientPricing(clientId),
    });

    const { data: products = [] } = useQuery({
        queryKey: ['ws_products'],
        queryFn: wholesaleApi.getProducts,
    });

    const activeProducts = products.filter(p => p.is_active);

    // Products that don't have custom pricing yet
    const availableProducts = activeProducts.filter(
        p => !pricing.some(pr => pr.product_id === p.id)
    );

    const upsertMutation = useMutation({
        mutationFn: (data: Partial<WsClientPricing>) => wholesaleApi.upsertClientPricing(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ws_client_pricing', clientId] });
            toast.success('Price updated');
            setAddingNew(false);
            setNewProductId('');
            setNewPrice('');
        },
        onError: () => toast.error('Failed to update price'),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => wholesaleApi.deleteClientPricing(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ws_client_pricing', clientId] });
            toast.success('Custom price removed');
        },
    });

    const getProductName = (productId: string) =>
        activeProducts.find(p => p.id === productId)?.name || 'Unknown';

    const getBasePrice = (productId: string) =>
        activeProducts.find(p => p.id === productId)?.base_sell_price || 0;

    const handleAddPrice = () => {
        if (!newProductId || !newPrice) return toast.error('Select product and enter price');
        upsertMutation.mutate({
            client_id: clientId,
            product_id: newProductId,
            sell_price: Number(newPrice),
        });
    };

    return (
        <div className="bg-slate-50 rounded-xl overflow-hidden">
            {pricing.length === 0 && !addingNew ? (
                <div className="text-center py-6 text-slate-400">
                    <p className="text-sm">No custom prices — base rates will apply</p>
                </div>
            ) : (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200">
                            <th className="text-left px-4 py-2.5 text-xs font-bold uppercase text-slate-500">Product</th>
                            <th className="text-right px-4 py-2.5 text-xs font-bold uppercase text-slate-500">Base Rate</th>
                            <th className="text-right px-4 py-2.5 text-xs font-bold uppercase text-slate-500">Client Rate</th>
                            <th className="text-center px-4 py-2.5 text-xs font-bold uppercase text-slate-500 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {pricing.map((p) => (
                            <tr key={p.id} className="border-b border-slate-100">
                                <td className="px-4 py-2.5 font-medium text-slate-700">{getProductName(p.product_id)}</td>
                                <td className="px-4 py-2.5 text-right text-slate-400 line-through">
                                    Rs. {getBasePrice(p.product_id).toLocaleString()}
                                </td>
                                <td className="px-4 py-2.5 text-right font-bold text-blue-700">
                                    Rs. {p.sell_price.toLocaleString()}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                    <button
                                        onClick={() => deleteMutation.mutate(p.id)}
                                        className="p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Add New Price Row */}
            {addingNew && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 border-t border-blue-100">
                    <select
                        value={newProductId}
                        onChange={(e) => setNewProductId(e.target.value)}
                        className="flex-1 h-9 px-2 text-sm rounded-lg border border-slate-200 bg-white"
                    >
                        <option value="">Select product</option>
                        {availableProducts.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.name} (Base: Rs.{p.base_sell_price})
                            </option>
                        ))}
                    </select>
                    <Input
                        type="number"
                        placeholder="Rate"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                        className="w-24 h-9 text-sm"
                        min="0"
                    />
                    <button
                        onClick={handleAddPrice}
                        className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    >
                        <Save className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Add Button */}
            <button
                onClick={() => setAddingNew(!addingNew)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors border-t border-slate-200"
            >
                <Plus className="w-3.5 h-3.5" />
                {addingNew ? 'Cancel' : 'Add Custom Price'}
            </button>
        </div>
    );
}
