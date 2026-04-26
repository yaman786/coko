import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { wholesaleApi } from '../../../services/wholesaleApi';
import { api } from '../../../services/api';
import { X, PackagePlus } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { toast } from 'sonner';
import type { WsProduct } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
    open: boolean;
    onClose: () => void;
    product: WsProduct | null;
}

export function RestockWsProductDialog({ open, onClose, product }: Props) {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [quantityToAdd, setQuantityToAdd] = useState('');
    const [restockDate, setRestockDate] = useState(() => new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (open) {
            setQuantityToAdd('');
            setRestockDate(new Date().toISOString().split('T')[0]);
        }
    }, [open]);

    const mutation = useMutation({
        mutationFn: async (qty: number) => {
            if (!product) throw new Error('No product selected');
            
            const newStock = product.stock + qty;
            
            // 1. Update the stock
            await wholesaleApi.upsertProduct({
                ...product,
                stock: newStock,
            });

            // 2. Log the activity specifically for Wholesale, allowing backdating
            const createdAtDate = restockDate ? new Date(restockDate) : new Date();

            await api.logActivity({
                action: 'PRODUCT_RESTOCKED',
                category: 'INVENTORY',
                description: `Restocked "${product.name}" in Wholesale Warehouse: ${product.stock} → ${newStock} (+${qty} ${product.unit}).`,
                metadata: { 
                    productId: product.id, 
                    name: product.name, 
                    previousStock: product.stock, 
                    newStock, 
                    added: qty,
                    portal: 'wholesale' 
                },
                actor_email: user?.email || 'unknown',
                actor_name: user?.email?.split('@')[0] || 'Unknown',
                createdAt: createdAtDate
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ws_products'] });
            // Also invalidate audit logs so the new activity shows up
            queryClient.invalidateQueries({ queryKey: ['auditLog', 'wholesale'] });
            toast.success('Stock Added', { description: `Successfully restocked ${product?.name}.` });
            onClose();
        },
        onError: () => toast.error('Failed to restock product'),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!product) return;
        
        const qty = Number(quantityToAdd);
        if (isNaN(qty) || qty <= 0) {
            return toast.error('Validation Error', { description: 'Please enter a valid positive quantity.' });
        }

        mutation.mutate(qty);
    };

    if (!open || !product) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl w-full max-w-sm mx-4 border border-white/20">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-sky-100 rounded-xl">
                            <PackagePlus className="w-5 h-5 text-sky-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 font-['DM_Sans',sans-serif] tracking-tight">
                                Receive Stock
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">{product.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <div className="flex justify-between mb-2 px-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Quantity to Add</label>
                            <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
                                Current: {product.stock} {product.unit}
                            </span>
                        </div>
                        <div className="relative">
                            <Input
                                type="number"
                                placeholder="0"
                                value={quantityToAdd}
                                onChange={(e) => setQuantityToAdd(e.target.value)}
                                className="h-14 text-lg font-bold bg-white/50 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-sky-500/20 pr-16"
                                min="1"
                                step="any"
                                autoFocus
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                                {product.unit}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif] mb-2 px-1">Restock Date</label>
                        <Input
                            type="date"
                            value={restockDate}
                            onChange={(e) => setRestockDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                            className="h-14 bg-white/50 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-sky-500/20 font-medium text-slate-700"
                        />
                        <p className="text-[10px] text-slate-400 mt-1.5 px-1 font-medium">Use this to backdate deliveries for accurate ledger history.</p>
                    </div>

                    <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 border-dashed">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-sky-700 font-medium">New Total Stock:</span>
                            <span className="font-black text-sky-900 text-lg">
                                {product.stock + (Number(quantityToAdd) || 0)} <span className="text-sm font-bold">{product.unit}</span>
                            </span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={mutation.isPending || !quantityToAdd || Number(quantityToAdd) <= 0}
                        className="w-full py-3.5 bg-sky-600 text-white rounded-xl font-bold text-sm hover:bg-sky-700 transition-colors disabled:opacity-50 shadow-sm flex justify-center items-center gap-2"
                    >
                        {mutation.isPending ? 'Processing...' : 'Confirm Restock'}
                    </button>
                </form>
            </div>
        </div>
    );
}
