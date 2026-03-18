import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { wholesaleApi } from '../../../services/wholesaleApi';
import { X } from 'lucide-react';
import { Input } from '../../../components/ui/input';
import { toast } from 'sonner';
import type { WsProduct } from '../../../types';

const UNITS = ['Carton', 'Liter', 'KG', 'Tray', 'Piece'] as const;
const CATEGORIES = ['Ice Cream', 'Frozen Desserts', 'Cones & Wafers', 'Toppings', 'Packaging', 'General'];

interface Props {
    open: boolean;
    onClose: () => void;
    editingProduct: WsProduct | null;
}

export function AddWsProductDialog({ open, onClose, editingProduct }: Props) {
    const queryClient = useQueryClient();
    const isEditing = !!editingProduct;

    const [form, setForm] = useState({
        name: '',
        category: 'Ice Cream',
        unit: 'Carton' as WsProduct['unit'],
        cost_price: '',
        base_sell_price: '',
        stock: '',
        min_stock: '5',
        description: '',
    });

    useEffect(() => {
        if (editingProduct) {
            setForm({
                name: editingProduct.name,
                category: editingProduct.category,
                unit: editingProduct.unit,
                cost_price: String(editingProduct.cost_price),
                base_sell_price: String(editingProduct.base_sell_price),
                stock: String(editingProduct.stock),
                min_stock: String(editingProduct.min_stock),
                description: editingProduct.description || '',
            });
        } else {
            setForm({
                name: '', category: 'Ice Cream', unit: 'Carton',
                cost_price: '', base_sell_price: '', stock: '',
                min_stock: '5', description: '',
            });
        }
    }, [editingProduct, open]);

    const mutation = useMutation({
        mutationFn: (product: Partial<WsProduct>) => wholesaleApi.upsertProduct(product),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ws_products'] });
            toast.success(isEditing ? 'Product updated' : 'Product added');
            onClose();
        },
        onError: () => toast.error('Failed to save product'),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return toast.error('Product name is required');
        if (!form.cost_price || Number(form.cost_price) < 0) return toast.error('Valid cost price required');
        if (!form.base_sell_price || Number(form.base_sell_price) < 0) return toast.error('Valid sell price required');

        mutation.mutate({
            ...(editingProduct && { id: editingProduct.id }),
            name: form.name.trim(),
            category: form.category,
            unit: form.unit,
            cost_price: Number(form.cost_price),
            base_sell_price: Number(form.base_sell_price),
            stock: Number(form.stock) || 0,
            min_stock: Number(form.min_stock) || 0,
            description: form.description.trim() || undefined,
            is_active: true,
        });
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h2 className="text-lg font-bold text-slate-800">
                        {isEditing ? 'Edit Product' : 'Add Wholesale Product'}
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Product Name *</label>
                        <Input
                            placeholder="e.g., Vanilla Ice Cream 5L Tub"
                            value={form.name}
                            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                            className="h-11"
                        />
                    </div>

                    {/* Category + Unit */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Category</label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                {CATEGORIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Unit</label>
                            <select
                                value={form.unit}
                                onChange={(e) => setForm(f => ({ ...f, unit: e.target.value as WsProduct['unit'] }))}
                                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            >
                                {UNITS.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Cost + Sell Price */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cost Price (Rs.) *</label>
                            <Input
                                type="number"
                                placeholder="200"
                                value={form.cost_price}
                                onChange={(e) => setForm(f => ({ ...f, cost_price: e.target.value }))}
                                className="h-11"
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Base Sell Price (Rs.) *</label>
                            <Input
                                type="number"
                                placeholder="300"
                                value={form.base_sell_price}
                                onChange={(e) => setForm(f => ({ ...f, base_sell_price: e.target.value }))}
                                className="h-11"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

                    {/* Margin Preview */}
                    {form.cost_price && form.base_sell_price && (
                        <div className="bg-blue-50 rounded-xl p-3 text-sm">
                            <span className="text-slate-600">Base Margin: </span>
                            <span className="font-bold text-blue-700">
                                Rs. {(Number(form.base_sell_price) - Number(form.cost_price)).toFixed(0)}
                            </span>
                            <span className="text-slate-500 ml-2">
                                ({((Number(form.base_sell_price) - Number(form.cost_price)) / Number(form.cost_price) * 100).toFixed(1)}%)
                            </span>
                        </div>
                    )}

                    {/* Stock + Min Stock */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Current Stock</label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={form.stock}
                                onChange={(e) => setForm(f => ({ ...f, stock: e.target.value }))}
                                className="h-11"
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Low Stock Alert</label>
                            <Input
                                type="number"
                                placeholder="5"
                                value={form.min_stock}
                                onChange={(e) => setForm(f => ({ ...f, min_stock: e.target.value }))}
                                className="h-11"
                                min="0"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description (optional)</label>
                        <textarea
                            placeholder="Any additional notes..."
                            value={form.description}
                            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                            rows={2}
                        />
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={mutation.isPending}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                    >
                        {mutation.isPending ? 'Saving...' : isEditing ? 'Update Product' : 'Add Product'}
                    </button>
                </form>
            </div>
        </div>
    );
}
