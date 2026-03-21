import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wholesaleApi } from '../../services/wholesaleApi';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Package, Plus, Search, AlertTriangle, Pencil, Trash2, Boxes } from 'lucide-react';
import { toast } from 'sonner';
import { AddWsProductDialog } from '../../features/wholesale/components/AddWsProductDialog';
import type { WsProduct } from '../../types';

export function WholesaleInventoryPage() {
    usePageTitle('Stock Warehouse', 'GOD');
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<WsProduct | null>(null);

    const { data: products = [], isLoading } = useQuery({
        queryKey: ['ws_products'],
        queryFn: wholesaleApi.getProducts,
    });

    const deleteMutation = useMutation({
        mutationFn: wholesaleApi.deleteProduct,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ws_products'] });
            toast.success('Product deactivated');
        },
        onError: () => toast.error('Failed to delete product'),
    });

    const activeProducts = useMemo(() =>
        products.filter(p => p.is_active),
        [products]
    );

    const filteredProducts = useMemo(() =>
        activeProducts.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.category.toLowerCase().includes(searchQuery.toLowerCase())
        ),
        [activeProducts, searchQuery]
    );

    const lowStockProducts = useMemo(() =>
        activeProducts.filter(p => p.stock <= p.min_stock),
        [activeProducts]
    );

    const categories = useMemo(() =>
        Array.from(new Set(activeProducts.map(p => p.category))),
        [activeProducts]
    );

    const totalStockValue = useMemo(() =>
        activeProducts.reduce((sum, p) => sum + (p.stock * p.cost_price), 0),
        [activeProducts]
    );

    const handleEdit = (product: WsProduct) => {
        setEditingProduct(product);
        setDialogOpen(true);
    };

    const handleAdd = () => {
        setEditingProduct(null);
        setDialogOpen(true);
    };

    const handleDialogClose = () => {
        setDialogOpen(false);
        setEditingProduct(null);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-800">
                        Stock <span className="text-sky-600">Warehouse</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Manage wholesale inventory</p>
                </div>
                <button
                    onClick={handleAdd}
                    className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl font-semibold text-sm hover:bg-sky-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add Product
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-0 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Products</CardTitle>
                        <Boxes className="w-4 h-4 text-sky-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-800">{activeProducts.length}</div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Categories</CardTitle>
                        <Package className="w-4 h-4 text-sky-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-800">{categories.length}</div>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Stock Value</CardTitle>
                        <Package className="w-4 h-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-800">Rs. {totalStockValue.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card className={`border-0 shadow-sm ${lowStockProducts.length > 0 ? 'ring-2 ring-amber-200' : ''}`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Low Stock</CardTitle>
                        <AlertTriangle className={`w-4 h-4 ${lowStockProducts.length > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${lowStockProducts.length > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                            {lowStockProducts.length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-11 bg-white focus-visible:ring-sky-500 focus-visible:border-sky-500"
                />
            </div>

            {/* Products Table */}
            <Card className="border-0 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/80">
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Product</th>
                                <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Category</th>
                                <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Stock</th>
                                <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Unit</th>
                                <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Cost</th>
                                <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Base Price</th>
                                <th className="text-center px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-16 text-slate-400">
                                        <Boxes className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                                        <p className="font-semibold">No products yet</p>
                                        <p className="text-sm mt-1">Click "Add Product" to start building your warehouse inventory</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr
                                        key={product.id}
                                        className="border-b border-slate-50 hover:bg-sky-50/30 transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-slate-800">{product.name}</div>
                                            {product.description && (
                                                <p className="text-xs text-slate-400 mt-0.5">{product.description}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-sky-50 text-sky-700">
                                                {product.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`font-bold ${product.stock <= product.min_stock ? 'text-amber-600' : 'text-slate-800'}`}>
                                                {product.stock}
                                            </span>
                                            {product.stock <= product.min_stock && (
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 inline ml-1.5" />
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-slate-600">{product.unit}</td>
                                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                                            Rs. {product.cost_price.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-bold text-sky-700">
                                            Rs. {product.base_sell_price.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => handleEdit(product)}
                                                    className="p-1.5 rounded-lg hover:bg-sky-100 text-slate-400 hover:text-sky-600 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Deactivate "${product.name}"?`)) {
                                                            deleteMutation.mutate(product.id);
                                                        }
                                                    }}
                                                    className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Add/Edit Dialog */}
            <AddWsProductDialog
                open={dialogOpen}
                onClose={handleDialogClose}
                editingProduct={editingProduct}
            />
        </div>
    );
}

export default WholesaleInventoryPage;
