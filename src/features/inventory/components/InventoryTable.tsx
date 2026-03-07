import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Plus, Edit3, Trash2, PackagePlus, Loader2, AlertTriangle, RefreshCcw, Archive } from 'lucide-react';
import { api } from '../../../services/api';
import type { Product } from '../../../types';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts/AuthContext';

export function InventoryTable() {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();
    const [showArchived, setShowArchived] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Product | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});

    // ── Restock state ──
    const [restockItem, setRestockItem] = useState<Product | null>(null);
    const [restockQty, setRestockQty] = useState('');
    const [restockTubs, setRestockTubs] = useState('');
    const [restockExtraScoops, setRestockExtraScoops] = useState('');
    const [restockYield, setRestockYield] = useState('24');
    const [restockTubCost, setRestockTubCost] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        category: 'Bio-products',
        subcategory: '',
        price: '',
        costPrice: '',
        stock: '',
        lowStockThreshold: '10',
        tubsReceived: '',
        tubCost: '',
        tubYield: '24',
    });

    // 1. Data Fetching
    const { data: products = [], isLoading } = useQuery({
        queryKey: ['products'],
        queryFn: api.getProducts
    });

    const upsertMutation = useMutation({
        mutationFn: api.upsertProduct,
        onSuccess: (_, product) => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            setIsAddDialogOpen(false);
            toast.success(editingItem ? 'Item Updated' : 'Item Added', {
                description: `"${product.name}" — Nrs. ${product.price}, Stock: ${product.stock}`
            });

            // Audit Trail
            api.logActivity({
                action: editingItem ? 'PRODUCT_UPDATED' : 'PRODUCT_ADDED',
                category: 'INVENTORY',
                description: `${editingItem ? 'Updated' : 'Added'} "${product.name}" — stock: ${product.stock}, price: Nrs. ${product.price}`,
                metadata: { productId: product.id, name: product.name, stock: product.stock, price: product.price },
                actor_email: user?.email || 'unknown',
                actor_name: user?.email?.split('@')[0] || 'Unknown',
            });

            resetForm();
        },
        onError: (error) => {
            console.error('Inventory save failed:', error);
            toast.error('Failed to save item', { description: String(error) });
        }
    });


    const resetForm = () => {
        setFormData({
            name: '', category: 'Bio-products', subcategory: '',
            price: '', costPrice: '', stock: '', lowStockThreshold: '10',
            tubsReceived: '', tubCost: '', tubYield: '24'
        });
        setEditingItem(null);
        setFormErrors({});
    };

    const handleOpenAdd = () => {
        resetForm();
        setIsAddDialogOpen(true);
    };

    const handleOpenEdit = (item: Product) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            category: item.category,
            subcategory: item.subcategory || '',
            price: item.price.toString(),
            costPrice: item.costPrice?.toString() || '0',
            stock: item.stock.toString(),
            lowStockThreshold: item.lowStockThreshold?.toString() || '10',
            tubsReceived: '',
            tubCost: item.tubCost?.toString() || '',
            tubYield: item.yield?.toString() || '23',
        });
        setIsAddDialogOpen(true);
    };

    const handleSaveItem = async () => {
        const isBulk = formData.category === 'Scoops';
        let hasError = false;
        const newErrors: Record<string, boolean> = {};

        // Input Validation
        if (!formData.name.trim()) {
            toast.error('Validation Error', { description: 'Product name is required.' });
            newErrors.name = true;
            hasError = true;
        }

        const price = parseFloat(formData.price);
        if (isNaN(price) || price <= 0) {
            if (!hasError) toast.error('Validation Error', { description: 'Price must be a positive number.' });
            newErrors.price = true;
            hasError = true;
        }

        const stockVal = parseInt(formData.stock);
        if (!isBulk && (isNaN(stockVal) || stockVal < 0)) {
            if (!hasError) toast.error('Validation Error', { description: 'Stock cannot be negative.' });
            newErrors.stock = true;
            hasError = true;
        }

        if (hasError) {
            setFormErrors(newErrors);
            return;
        }
        setFormErrors({});

        // Option 3 Logic: The `formData.stock` field is the absolute source of truth.
        // The dynamic calculation happens during the `onChange` of tubsReceived.
        const updatedStock = parseInt(formData.stock) || 0;

        const parsedThreshold = parseInt(formData.lowStockThreshold);

        upsertMutation.mutate({
            id: editingItem?.id || crypto.randomUUID(),
            name: formData.name,
            category: formData.category || 'Other',
            subcategory: formData.subcategory || undefined,
            price: parseFloat(formData.price) || 0,
            costPrice: isBulk ? ((parseFloat(formData.tubCost) || 0) / (parseInt(formData.tubYield) || 23)) : (parseFloat(formData.costPrice) || 0),
            isBulk: isBulk,
            yield: isBulk ? (parseInt(formData.tubYield) || 23) : undefined,
            tubCost: isBulk ? (parseFloat(formData.tubCost) || 0) : undefined,
            stock: updatedStock,
            lowStockThreshold: isNaN(parsedThreshold) ? 10 : parsedThreshold,
            updatedAt: new Date(),
            isDeleted: editingItem?.isDeleted || false,
            user_id: user?.id
        });
    };

    const handleDeleteItem = async (product: Product) => {
        if (confirm('Are you sure you want to delete this item?')) {
            upsertMutation.mutate({ ...product, isDeleted: true });
        }
    };

    const handleRestoreItem = async (product: Product) => {
        upsertMutation.mutate({ ...product, isDeleted: false });
    };

    // ── Restock handlers ──
    const handleOpenRestock = (item: Product) => {
        setRestockItem(item);
        setRestockQty('');
        setRestockTubs('');
        setRestockExtraScoops('');
        setRestockYield(item.yield?.toString() || '24');
        setRestockTubCost('');
    };

    const handleConfirmRestock = () => {
        if (!restockItem) return;
        const addQty = parseInt(restockQty) || 0;
        if (addQty <= 0) {
            toast.error('Invalid quantity', { description: 'Enter a positive number to add.' });
            return;
        }
        const newStock = restockItem.stock + addQty;

        // ── Weighted Average Cost Price ──
        // If user entered a new Cost/Tub, blend old stock cost with new batch cost.
        // If left blank, keep the existing costPrice unchanged.
        let newCostPrice = restockItem.costPrice;
        const newTubCost = parseFloat(restockTubCost);
        const yieldPerTub = parseFloat(restockYield) || 24;
        if (!isNaN(newTubCost) && newTubCost > 0) {
            const newCostPerScoop = newTubCost / yieldPerTub;
            const oldValue = (restockItem.stock) * (restockItem.costPrice || 0);
            const newValue = addQty * newCostPerScoop;
            newCostPrice = (oldValue + newValue) / newStock;
        }

        upsertMutation.mutate(
            { ...restockItem, stock: newStock, costPrice: newCostPrice },
            {
                onSuccess: () => {
                    toast.success('Stock Updated', {
                        description: `"${restockItem.name}" restocked: ${restockItem.stock} → ${newStock} (+${addQty})`,
                    });
                    api.logActivity({
                        action: 'PRODUCT_RESTOCKED',
                        category: 'INVENTORY',
                        description: `Restocked "${restockItem.name}": ${restockItem.stock} → ${newStock} (+${addQty}). Cost/scoop: Nrs.${newCostPrice?.toFixed(2)}`,
                        metadata: { productId: restockItem.id, name: restockItem.name, previousStock: restockItem.stock, newStock, added: addQty, newCostPrice },
                        actor_email: user?.email || 'unknown',
                        actor_name: user?.email?.split('@')[0] || 'Unknown',
                    });
                    setRestockItem(null);
                }
            }
        );
    };

    const filteredInventory = useMemo(() => {
        const filtered = showArchived ? products : products.filter(p => !p.isDeleted);
        return filtered.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.subcategory && item.subcategory.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [products, showArchived, searchQuery]);

    const lowStockItems = useMemo(() =>
        products.filter(item => !item.isDeleted && item.stock <= (item.lowStockThreshold ?? 10)),
        [products]
    );

    if (isLoading) {
        return (
            <div className="flex justify-center flex-col gap-4 items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                <p className="text-gray-500 font-medium">Loading inventory...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {lowStockItems.length > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-700">
                            <AlertTriangle className="w-5 h-5" />
                            Low Stock Alert
                        </CardTitle>
                        <CardDescription>
                            {lowStockItems.length} items need restocking
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {lowStockItems.map(item => (
                                <Badge key={item.id} variant="outline" className="border-orange-300 text-orange-700">
                                    {item.name}: {item.stock} pcs
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="shadow-sm border-0 ring-1 ring-gray-200">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Inventory Management</CardTitle>
                            <CardDescription>Track and manage your entire product catalog (Live)</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            {role === 'admin' && (
                                <Button
                                    variant="outline"
                                    onClick={() => setShowArchived(!showArchived)}
                                    className={`gap-2 h-10 ${showArchived ? 'bg-purple-50 border-purple-200 text-purple-700' : 'text-gray-500'}`}
                                >
                                    <Archive className="w-4 h-4" />
                                    {showArchived ? 'Active Inventory' : 'View Archived'}
                                </Button>
                            )}
                            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                                setIsAddDialogOpen(open);
                                if (!open) resetForm();
                            }}>
                                <DialogTrigger asChild>
                                    <Button onClick={handleOpenAdd} className="gap-2 h-10 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-sm text-white">
                                        <Plus className="w-4 h-4" /> Add Item
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Product Category</Label>
                                            <div className="flex gap-2 p-1 bg-gray-100/80 rounded-lg">
                                                {['Scoops', 'Bio-products', 'Bubble Tea'].map(cat => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, category: cat })}
                                                        className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${formData.category === cat ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60' : 'text-gray-500 hover:text-gray-900'}`}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="name">Item Name</Label>
                                                <Input
                                                    id="name"
                                                    value={formData.name}
                                                    className={formErrors.name ? 'border-red-500 ring-1 ring-red-500' : ''}
                                                    aria-invalid={!!formErrors.name}
                                                    onChange={(e) => {
                                                        setFormData({ ...formData, name: e.target.value });
                                                        if (formErrors.name) setFormErrors({ ...formErrors, name: false });
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="subcategory">Subcategory</Label>
                                                <Input id="subcategory" value={formData.subcategory} onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })} />
                                            </div>
                                        </div>
                                        {formData.category === 'Scoops' ? (
                                            <>
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Tubs</Label>
                                                        <Input
                                                            type="number"
                                                            value={formData.tubsReceived}
                                                            onChange={(e) => {
                                                                const tubs = parseInt(e.target.value) || 0;
                                                                const yld = parseInt(formData.tubYield) || 23;
                                                                const currentStock = editingItem ? editingItem.stock : 0;
                                                                const newStock = currentStock + (tubs * yld);

                                                                setFormData({
                                                                    ...formData,
                                                                    tubsReceived: e.target.value,
                                                                    stock: newStock.toString()
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="space-y-2"><Label>Yield</Label><Input type="number" value={formData.tubYield} onChange={(e) => setFormData({ ...formData, tubYield: e.target.value })} /></div>
                                                    <div className="space-y-2"><Label>Cost/Tub</Label><Input type="number" min="0" value={formData.tubCost} onChange={(e) => setFormData({ ...formData, tubCost: e.target.value })} /></div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="space-y-2"><Label>Current Stock (Scoops)</Label><Input type="number" min="0" step="1" aria-invalid={!!formErrors.stock} className={formErrors.stock ? 'border-red-500 ring-1 ring-red-500 font-bold bg-amber-50' : 'font-bold bg-amber-50'} value={formData.stock} onChange={(e) => { setFormData({ ...formData, stock: e.target.value }); if (formErrors.stock) setFormErrors({ ...formErrors, stock: false }); }} /></div>
                                                    <div className="space-y-2"><Label>Price/Scoop</Label><Input type="number" min="0" step="1" aria-invalid={!!formErrors.price} className={formErrors.price ? 'border-red-500 ring-1 ring-red-500' : ''} value={formData.price} onChange={(e) => { setFormData({ ...formData, price: e.target.value }); if (formErrors.price) setFormErrors({ ...formErrors, price: false }); }} /></div>
                                                    <div className="space-y-2"><Label>Alert When Stock ≤</Label><Input type="number" min="0" step="1" value={formData.lowStockThreshold} onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })} /></div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2"><Label>Price</Label><Input type="number" min="0" step="1" className={formErrors.price ? 'border-red-500 ring-1 ring-red-500' : ''} aria-invalid={!!formErrors.price} value={formData.price} onChange={(e) => { setFormData({ ...formData, price: e.target.value }); if (formErrors.price) setFormErrors({ ...formErrors, price: false }); }} /></div>
                                                    <div className="space-y-2"><Label>Cost Price</Label><Input type="number" min="0" step="1" value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })} /></div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2"><Label>Stock</Label><Input type="number" min="0" step="1" className={formErrors.stock ? 'border-red-500 ring-1 ring-red-500' : ''} aria-invalid={!!formErrors.stock} value={formData.stock} onChange={(e) => { setFormData({ ...formData, stock: e.target.value }); if (formErrors.stock) setFormErrors({ ...formErrors, stock: false }); }} /></div>
                                                    <div className="space-y-2"><Label>Alert When Stock ≤</Label><Input type="number" min="0" step="1" value={formData.lowStockThreshold} onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })} /></div>
                                                </div>
                                            </>
                                        )}
                                        <Button onClick={handleSaveItem} disabled={upsertMutation.isPending} className="w-full bg-purple-600">
                                            {upsertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                            {editingItem ? 'Save Changes' : 'Add Item'}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="mb-6 max-w-sm" />
                    <div className="rounded-xl border shadow-sm overflow-x-auto">
                        <Table className="min-w-[600px]">
                            <TableHeader className="bg-gray-50/80">
                                <TableRow>
                                    <TableHead>Item Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">Stock</TableHead>
                                    <TableHead className="text-right">Selling Price</TableHead>
                                    <TableHead className="text-center w-[160px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredInventory.map(item => (
                                    <TableRow key={item.id} className={item.isDeleted ? 'opacity-60 bg-slate-50' : ''}>
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        <TableCell>{item.category}</TableCell>
                                        <TableCell className="text-right">
                                            {item.stock <= 0 ? (
                                                <Badge variant="destructive" className="animate-pulse bg-red-100 text-red-700 border border-red-200 shadow-none">
                                                    Out of Stock
                                                </Badge>
                                            ) : item.stock <= Math.max(1, Math.floor((item.lowStockThreshold ?? 10) / 2)) ? (
                                                <Badge className="bg-red-50 text-red-600 border border-red-200 shadow-none font-bold">
                                                    {item.stock} pcs ⚠️
                                                </Badge>
                                            ) : item.stock <= (item.lowStockThreshold ?? 10) ? (
                                                <Badge className="bg-amber-50 text-amber-700 border border-amber-200 shadow-none font-bold">
                                                    {item.stock} pcs
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-none font-bold">
                                                    {item.stock} pcs
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">Nrs.{item.price}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {item.isDeleted ? (
                                                    <Button variant="ghost" size="sm" onClick={() => handleRestoreItem(item)}><RefreshCcw className="w-4 h-4" /></Button>
                                                ) : (
                                                    <>
                                                        <Button variant="ghost" size="sm" onClick={() => handleOpenRestock(item)} className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" title="Quick Restock"><PackagePlus className="w-4 h-4" /></Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)}><Edit3 className="w-4 h-4" /></Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            {/* ── Quick Restock Dialog ── */}
            <Dialog open={!!restockItem} onOpenChange={(open) => { if (!open) setRestockItem(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <PackagePlus className="w-5 h-5 text-emerald-600" />
                            Restock: {restockItem?.name}
                        </DialogTitle>
                    </DialogHeader>
                    {restockItem && (
                        <div className="space-y-5 py-2">
                            {/* Current stock display */}
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <span className="text-sm font-medium text-slate-600">Current Stock</span>
                                <span className="text-lg font-black text-slate-800">{restockItem.stock} {restockItem.category === 'Scoops' ? 'scoops' : 'pcs'}</span>
                            </div>

                            {/* Scoops: Tub + Extra Scoops Restock */}
                            {restockItem.category === 'Scoops' ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50">
                                            <Label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase">
                                                <PackagePlus className="w-3.5 h-3.5" /> Full Tubs to Add
                                            </Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                value={restockTubs}
                                                onChange={(e) => {
                                                    setRestockTubs(e.target.value);
                                                    const tubs = parseInt(e.target.value) || 0;
                                                    const extra = parseInt(restockExtraScoops) || 0;
                                                    const yld = parseInt(restockYield) || 24;
                                                    if (tubs > 0 || extra > 0) {
                                                        setRestockQty((tubs * yld + extra).toString());
                                                    } else {
                                                        setRestockQty('');
                                                    }
                                                }}
                                                className="h-10 text-lg font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">🥄 Extra Loose Scoops</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                value={restockExtraScoops}
                                                onChange={(e) => {
                                                    setRestockExtraScoops(e.target.value);
                                                    const tubs = parseInt(restockTubs) || 0;
                                                    const extra = parseInt(e.target.value) || 0;
                                                    const yld = parseInt(restockYield) || 24;
                                                    if (tubs > 0 || extra > 0) {
                                                        setRestockQty((tubs * yld + extra).toString());
                                                    } else {
                                                        setRestockQty('');
                                                    }
                                                }}
                                                className="h-10 text-lg font-bold"
                                            />
                                        </div>
                                    </div>

                                    {/* Cost/Tub field for weighted average calculation */}
                                    <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200/60 space-y-2">
                                        <Label className="text-xs font-bold text-amber-700 uppercase tracking-wider">New Cost/Tub (Optional)</Label>
                                        <p className="text-xs text-amber-700/80 mb-1">Updates your blended cost per scoop. Leave blank if prices haven't changed.</p>
                                        <Input
                                            type="number"
                                            min="0"
                                            placeholder={`Default: Nrs. ${((restockItem.costPrice || 0) * (parseFloat(restockYield) || 24)).toFixed(0)}/tub`}
                                            value={restockTubCost}
                                            onChange={(e) => setRestockTubCost(e.target.value)}
                                            className="h-9"
                                        />
                                        {restockTubCost && parseFloat(restockTubCost) > 0 && (parseInt(restockQty) || 0) > 0 && (() => {
                                            const newCostPerScoop = parseFloat(restockTubCost) / (parseFloat(restockYield) || 24);
                                            const oldValue = restockItem.stock * (restockItem.costPrice || 0);
                                            const newValue = (parseInt(restockQty) || 0) * newCostPerScoop;
                                            const totalStock = restockItem.stock + (parseInt(restockQty) || 0);
                                            const blended = totalStock > 0 ? (oldValue + newValue) / totalStock : 0;
                                            return (
                                                <p className="text-xs text-amber-700 font-semibold mt-2">
                                                    Blended cost: Nrs. {blended.toFixed(2)}/scoop
                                                    <span className="text-slate-400 font-normal"> (was Nrs. {(restockItem.costPrice || 0).toFixed(2)}/scoop)</span>
                                                </p>
                                            );
                                        })()}
                                    </div>

                                    {/* Preview */}
                                    {(parseInt(restockQty) || 0) > 0 && (
                                        <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200 mt-2">
                                            <span className="text-sm font-medium text-emerald-800">Total Scoops to Add:</span>
                                            <span className="text-xl font-black text-emerald-700">+{restockQty || '0'} scoops</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Main input: Add quantity for non-scoops */}
                                    <Label className="text-sm font-semibold">Add Quantity</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        placeholder="Enter quantity to add..."
                                        value={restockQty}
                                        onChange={(e) => setRestockQty(e.target.value)}
                                        className="h-11 text-lg font-bold"
                                        autoFocus
                                    />
                                    {/* Preview */}
                                    {(parseInt(restockQty) || 0) > 0 && (
                                        <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-200 mt-2">
                                            <span className="text-sm font-medium text-emerald-700">New Stock</span>
                                            <span className="text-lg font-black text-emerald-700">
                                                {restockItem.stock} + {parseInt(restockQty) || 0} = {restockItem.stock + (parseInt(restockQty) || 0)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            <Button
                                onClick={handleConfirmRestock}
                                disabled={!restockQty || (parseInt(restockQty) || 0) <= 0 || upsertMutation.isPending}
                                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            >
                                {upsertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Confirm Restock
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
}
