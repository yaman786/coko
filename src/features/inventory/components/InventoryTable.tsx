import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Badge } from '../../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from '../../../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Plus, Edit3, Trash2, PackagePlus, Loader2, AlertTriangle, RefreshCcw, Archive, History, Boxes, ChevronRight, ChevronDown, Info } from 'lucide-react';

import { Separator } from '../../../components/ui/separator';
import { api } from '../../../services/api';
import { supabase } from '../../../lib/supabase';
import type { Product } from '../../../types';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts/AuthContext';
import { ProductDailyLedgerDialog } from './ProductDailyLedgerDialog';

export function InventoryTable() {
    const { user, role } = useAuth();
    const queryClient = useQueryClient();
    const [showArchived, setShowArchived] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Product | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});
    const [ledgerProduct, setLedgerProduct] = useState<Product | null>(null);
    const [deletingItem, setDeletingItem] = useState<Product | null>(null);
    const [expandedPopcorn, setExpandedPopcorn] = useState<Set<string>>(new Set());
    const [permanentDeleteItem, setPermanentDeleteItem] = useState<Product | null>(null);
    const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

    // ── Restock state ──
    const [restockItem, setRestockItem] = useState<Product | null>(null);
    const [restockQty, setRestockQty] = useState('');
    const [restockTubs, setRestockTubs] = useState('');
    const [restockExtraScoops, setRestockExtraScoops] = useState('');
    const [restockYield, setRestockYield] = useState('24');
    const [restockTubCost, setRestockTubCost] = useState('');
    const [restockPopcornWeight, setRestockPopcornWeight] = useState('');
    const [restockPopcornBoxes, setRestockPopcornBoxes] = useState('');



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
        trackInventory: true,
        parentId: '',
        stockMultiplier: '1',
        unit: 'pcs',
        boxWeight: '',
        popcornInitialStock: '',
        halfServingSize: '',
        halfPrice: '',
        fullServingSize: '',
        fullPrice: '',
    });

    // 1. Data Fetching
    const { data: products = [], isLoading } = useQuery({
        queryKey: ['products', 'retail'],
        queryFn: () => api.getProducts('retail')
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
            tubsReceived: '', tubCost: '', tubYield: '24',
            trackInventory: true, parentId: '', stockMultiplier: '1', unit: 'pcs',
            boxWeight: '', popcornInitialStock: '', halfServingSize: '', halfPrice: '', fullServingSize: '', fullPrice: ''
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

        if (item.category === 'Popcorn') {
            const masterId = item.parentId || item.id;
            const master = products.find(p => p.id === masterId);
            const variants = products.filter(p => p.parentId === masterId);
            const half = variants.find(v => v.name.includes('(Half)'));
            const full = variants.find(v => v.name.includes('(Full)'));

            const boxWeight = master?.yield || 0;

            setFormData({
                name: (master?.name || item.name).replace(' (STOCK)', ''),
                category: 'Popcorn',
                subcategory: '',
                price: item.price.toString(),
                costPrice: item.costPrice?.toString() || '0',
                stock: (master?.stock || 0).toString(),
                lowStockThreshold: (master?.lowStockThreshold || 10).toString(),
                tubsReceived: '',
                tubCost: (master?.tubCost || 0).toString(),
                tubYield: (master?.yield || 24).toString(),
                trackInventory: true,
                parentId: masterId,
                stockMultiplier: item.stockMultiplier?.toString() || '1',
                unit: 'box',
                boxWeight: boxWeight.toString(),
                popcornInitialStock: '',
                halfServingSize: half ? half.stockMultiplier?.toString() || '' : '',
                halfPrice: half ? half.price.toString() : '',
                fullServingSize: full ? full.stockMultiplier?.toString() || '' : '',
                fullPrice: full ? full.price.toString() : '',
            });
        } else {
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
                trackInventory: item.trackInventory !== false,
                parentId: item.parentId || '',
                stockMultiplier: item.stockMultiplier?.toString() || '1',
                unit: item.unit || 'pcs',
                boxWeight: '', popcornInitialStock: '', halfServingSize: '', halfPrice: '', fullServingSize: '', fullPrice: ''
            });
        }
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

        if (formData.category !== 'Popcorn') {
            const price = parseFloat(formData.price);
            if (isNaN(price) || price <= 0) {
                if (!hasError) toast.error('Validation Error', { description: 'Price must be a positive number.' });
                newErrors.price = true;
                hasError = true;
            }
        }

        const stockVal = parseInt(formData.stock);
        // Only validate stock override if editing
        if (editingItem && isNaN(stockVal)) {
            if (!hasError) toast.error('Validation Error', { description: 'Stock must be a valid number.' });
            newErrors.stock = true;
            hasError = true;
        }

        if (hasError) {
            setFormErrors(newErrors);
            return;
        }
        setFormErrors({});

        if (formData.category === 'Popcorn') {
            try {
                // Determine IDs
                const masterId = editingItem?.parentId || editingItem?.id || crypto.randomUUID();
                const boxCost = parseFloat(formData.tubCost) || 0;

                // Find existing variants if editing
                const variants = products.filter(v => v.parentId === masterId);
                const existingHalf = variants.find(v => v.name.includes('(Half)'));
                const existingFull = variants.find(v => v.name.includes('(Full)'));

                // 1. Master Product (The Stock Container - hidden in POS usually)
                const masterProduct: Product = {
                    id: masterId,
                    name: `${formData.name} (STOCK)`,
                    category: 'Popcorn',
                    price: 0,
                    // Standardize: Parent stores cost-per-gram (Unit Cost) from birth
                    costPrice: (parseFloat(formData.tubCost) || 0) / (parseInt(formData.boxWeight) || 10000),
                    isBulk: true,
                    // Use yield as the reference grams-per-box (defaults to 10000 for new, or existing yield for edit)
                    yield: editingItem ? (parseInt(formData.boxWeight) || products.find(p => p.id === masterId)?.yield || 10000) : 10000,
                    tubCost: boxCost,
                    stock: editingItem ? (parseFloat(formData.stock) || 0) : 0,
                    lowStockThreshold: parseInt(formData.lowStockThreshold) || 5,
                    trackInventory: true,
                    unit: 'g',
                    updatedAt: new Date(),
                    user_id: user?.id,
                    isDeleted: false
                };

                const halfServingSize = parseFloat(formData.halfServingSize) || 0;
                const fullServingSize = parseFloat(formData.fullServingSize) || 0;
                const refWeight = masterProduct.yield || 1;

                // 2. Half Serving
                const halfProduct: Product = {
                    id: existingHalf?.id || crypto.randomUUID(),
                    name: `${formData.name} (Half)`,
                    category: 'Popcorn',
                    price: parseFloat(formData.halfPrice) || 0,
                    costPrice: (boxCost / refWeight) * halfServingSize,
                    parentId: masterId,
                    stockMultiplier: halfServingSize, // We store grams directly as multiplier for 1:1 deduction
                    stock: 0,
                    unit: 'pcs',
                    trackInventory: true,
                    updatedAt: new Date(),
                    user_id: user?.id,
                    isDeleted: false
                };

                // 3. Full Serving
                const fullProduct: Product = {
                    id: existingFull?.id || crypto.randomUUID(),
                    name: `${formData.name} (Full)`,
                    category: 'Popcorn',
                    price: parseFloat(formData.fullPrice) || 0,
                    costPrice: (boxCost / refWeight) * fullServingSize,
                    parentId: masterId,
                    stockMultiplier: fullServingSize,
                    stock: 0,
                    unit: 'pcs',
                    trackInventory: true,
                    updatedAt: new Date(),
                    user_id: user?.id,
                    isDeleted: false
                };

                // Execute all upserts
                await Promise.all([
                    upsertMutation.mutateAsync(masterProduct),
                    upsertMutation.mutateAsync(halfProduct),
                    upsertMutation.mutateAsync(fullProduct)
                ]);

                setIsAddDialogOpen(false);
                resetForm();
                return;
            } catch (error) {
                console.error('Popcorn save failed:', error);
                return;
            }
        }

        // Strict Workflow: New items mathematically always start at 0. 
        // Only during editing can a manager override the exact stock count.
        const updatedStock = editingItem ? (parseInt(formData.stock) || 0) : 0;
        const parsedThreshold = parseInt(formData.lowStockThreshold);

        upsertMutation.mutate({
            id: editingItem?.id || crypto.randomUUID(),
            name: formData.name,
            category: formData.category || 'Other',
            subcategory: formData.subcategory || undefined,
            price: parseFloat(formData.price) || 0,
            costPrice: isBulk ? ((parseFloat(formData.tubCost) || 0) / (parseInt(formData.tubYield) || 24)) : (parseFloat(formData.costPrice) || 0),
            isBulk: isBulk,
            yield: isBulk ? (parseInt(formData.tubYield) || 24) : undefined,
            tubCost: isBulk ? (parseFloat(formData.tubCost) || 0) : undefined,
            stock: updatedStock,
            lowStockThreshold: isNaN(parsedThreshold) ? 10 : parsedThreshold,
            trackInventory: formData.trackInventory,
            stockMultiplier: parseFloat(formData.stockMultiplier) || 1,
            unit: formData.unit,
            parentId: formData.parentId || undefined,
            updatedAt: new Date(),
            isDeleted: editingItem?.isDeleted || false,
            user_id: user?.id
        });
    };

    const handleDeleteItem = (product: Product) => {
        setDeletingItem(product);
    };

    const confirmDelete = () => {
        if (!deletingItem) return;
        const product = deletingItem;
        setDeletingItem(null);

        upsertMutation.mutate(
            { ...product, isDeleted: true },
            {
                onSuccess: () => {
                    toast.success('Item Deleted', {
                        description: `"${product.name}" has been moved to archive.`,
                    });
                    api.logActivity({
                        action: 'PRODUCT_DELETED',
                        category: 'INVENTORY',
                        description: `Deleted (archived) product "${product.name}" (ID: ${product.id})`,
                        metadata: { productId: product.id, name: product.name },
                        actor_email: user?.email || 'unknown',
                        actor_name: user?.email?.split('@')[0] || 'Unknown',
                    });
                }
            }
        );
    };

    const handleRestoreItem = async (product: Product) => {
        upsertMutation.mutate({ ...product, isDeleted: false });
    };

    const handlePermanentDelete = (product: Product) => {
        setPermanentDeleteItem(product);
    };

    const confirmPermanentDelete = async () => {
        if (!permanentDeleteItem) return;
        const product = permanentDeleteItem;
        setPermanentDeleteItem(null);
        try {
            const { error } = await supabase.from('products').delete().eq('id', product.id);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('Permanently Deleted', { description: `"${product.name}" has been permanently removed.` });
            api.logActivity({
                action: 'PRODUCT_PERMANENT_DELETE',
                category: 'INVENTORY',
                description: `Permanently deleted "${product.name}" (ID: ${product.id})`,
                metadata: { productId: product.id, name: product.name },
                actor_email: user?.email || 'unknown',
                actor_name: user?.email?.split('@')[0] || 'Unknown',
            });
        } catch (err) {
            toast.error('Failed to delete', { description: 'Could not permanently delete. There may be linked orders.' });
        }
    };

    const archivedItems = useMemo(() => products.filter(p => p.isDeleted), [products]);

    const confirmClearAllArchived = async () => {
        setShowClearAllConfirm(false);
        const archived = archivedItems;
        if (archived.length === 0) return;

        try {
            const ids = archived.map(p => p.id);
            const { error } = await supabase.from('products').delete().in('id', ids);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('All Archived Cleared', { description: `${archived.length} products permanently deleted.` });
            api.logActivity({
                action: 'CLEAR_ALL_ARCHIVED',
                category: 'INVENTORY',
                description: `Permanently deleted ${archived.length} archived products`,
                metadata: { count: archived.length, names: archived.map(p => p.name) },
                actor_email: user?.email || 'unknown',
                actor_name: user?.email?.split('@')[0] || 'Unknown',
            });
        } catch (err) {
            toast.error('Failed to clear', { description: 'Could not delete all archived items. Some may have linked orders.' });
        }
    };

    // ── Restock handlers ──
    const handleOpenRestock = (item: Product) => {
        setRestockItem(item);
        setRestockQty('');
        setRestockTubs('');
        setRestockExtraScoops('');
        setRestockYield(item.yield?.toString() || '24');
        setRestockTubCost('');
        setRestockPopcornWeight('');
        setRestockPopcornBoxes('');
    };

    const handleConfirmRestock = () => {
        if (!restockItem) return;

        let addWeight = 0;
        let addBoxes = 1;
        let addQty = parseInt(restockQty) || 0;

        if (restockItem.category === 'Popcorn') {
            addWeight = parseFloat(restockPopcornWeight) || 0;
            addBoxes = parseFloat(restockPopcornBoxes) || 1;
            if (addWeight <= 0) {
                toast.error('Invalid weight', { description: 'Enter a positive weight to add.' });
                return;
            }
        } else if (addQty <= 0) {
            toast.error('Invalid quantity', { description: 'Enter a positive number to add.' });
            return;
        }

        let currentStock = restockItem.stock;
        let reconciledGainValue = 0;
        let wasAutoReconciled = false;

        // Smart Restock Logic: If stock is negative, it's "Over-yield Gain" from the old tub.
        // We log it as a Gain and reset to 0 before adding the new stock so the new tub starts fresh (e.g. at 24).
        if (currentStock < 0) {
            wasAutoReconciled = true;
            const variance = Math.abs(currentStock);
            reconciledGainValue = variance * (restockItem.price || 0);
            
            api.logActivity({
                action: 'STOCK_ADJUSTMENT',
                category: 'INVENTORY',
                description: `Auto-reconciled extra yield for "${restockItem.name}" before restock: ${currentStock} → 0 (+${variance} Gain).`,
                metadata: { 
                    productId: restockItem.id, 
                    name: restockItem.name,
                    reason: 'Over-yield Gain',
                    notes: 'Auto-reconciled during restock of negative balance.',
                    previousStock: currentStock, 
                    newStock: 0, 
                    variance: variance,
                    variance_value: reconciledGainValue,
                    variance_type: 'PROFIT_GAIN'
                },
                actor_email: user?.email || 'unknown',
                actor_name: user?.email?.split('@')[0] || 'Unknown',
            });
            currentStock = 0;
        }

        const newStock = currentStock + (restockItem.category === 'Popcorn' ? addWeight : addQty);
        let newCostPrice = restockItem.costPrice;
        const newTubCost = parseFloat(restockTubCost);
        const yieldPerTub = parseFloat(restockYield) || 24;

        if (restockItem.category === 'Popcorn') {
            // Updated cost per gram calculation
            if (!isNaN(newTubCost) && newTubCost > 0) {
                const batchCostPerGram = newTubCost / Math.max(1, addWeight);
                const oldValue = (currentStock) * (restockItem.costPrice || 0);
                const newValue = addWeight * batchCostPerGram;
                newCostPrice = (oldValue + newValue) / newStock;
            }

            // Reference weight (grams per box) for this batch
            const newRefWeight = addWeight / Math.max(1, addBoxes);

            // Sync variants: popcorn variants are weight-based
            const variants = products.filter(p => p.parentId === restockItem.id);
            const updatePromises = variants.map(v =>
                api.upsertProduct({
                    ...v,
                    costPrice: (newCostPrice || 0) * (v.stockMultiplier || 1),
                    updatedAt: new Date()
                })
            );

            upsertMutation.mutate(
                { ...restockItem, stock: newStock, costPrice: newCostPrice, yield: newRefWeight },
                {
                    onSuccess: async () => {
                        if (updatePromises.length > 0) {
                            await Promise.all(updatePromises);
                            queryClient.invalidateQueries({ queryKey: ['products'] });
                        }
                        toast.success('Popcorn Restocked', { description: `Added ${addWeight}g across ${addBoxes} boxes.` });
                        setRestockItem(null);
                    }
                }
            );
        } else {
            // Blended cost for Scoops
            if (restockItem.category === 'Scoops' && !isNaN(newTubCost) && newTubCost > 0) {
                const newCostPerScoop = newTubCost / yieldPerTub;
                const oldValue = (currentStock) * (restockItem.costPrice || 0);
                const newValue = addQty * newCostPerScoop;
                newCostPrice = (oldValue + newValue) / newStock;
            }

            // Update Variants automatically if this is a parent product
            const variants = products.filter(p => p.parentId === restockItem.id);
            const updatePromises = variants.map(v =>
                api.upsertProduct({
                    ...v,
                    costPrice: (newCostPrice || 0) * (v.stockMultiplier || 1),
                    updatedAt: new Date()
                })
            );

            upsertMutation.mutate(
                { ...restockItem, stock: newStock, costPrice: newCostPrice },
                {
                    onSuccess: async () => {
                        if (updatePromises.length > 0) {
                            try {
                                await Promise.all(updatePromises);
                                queryClient.invalidateQueries({ queryKey: ['products'] });
                            } catch (err) {
                                console.error("Failed to sync variant costs:", err);
                            }
                        }

                        toast.success('Stock Updated', {
                            description: `"${restockItem.name}" restocked and ${variants.length} variants synchronized.`,
                        });
                        api.logActivity({
                            action: 'PRODUCT_RESTOCKED',
                            category: 'INVENTORY',
                            description: `Restocked "${restockItem.name}": ${restockItem.stock} → ${newStock} (+${addQty}).${wasAutoReconciled ? ' (Auto-reconciled negative balance)' : ''} Cost: Nrs.${newCostPrice?.toFixed(2)}`,
                            metadata: { productId: restockItem.id, name: restockItem.name, previousStock: restockItem.stock, newStock, added: addQty, newCostPrice, variantCount: variants.length, autoReconciled: wasAutoReconciled },
                            actor_email: user?.email || 'unknown',
                            actor_name: user?.email?.split('@')[0] || 'Unknown',
                        });
                        setRestockItem(null);
                    }
                }
            );
        }
    };



    const filteredInventory = useMemo(() => {
        let filtered = showArchived ? products : products.filter(p => !p.isDeleted);

        // Hide popcorn child variants — they'll be rendered as sub-rows under their parent
        filtered = filtered.filter(p => !(p.category === 'Popcorn' && p.parentId));

        // For Popcorn STOCK parents: show them (they are the group header)
        // For all other (STOCK) items: keep hidden
        // No filtering needed since only Popcorn uses (STOCK) pattern

        return filtered.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.subcategory && item.subcategory.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [products, showArchived, searchQuery]);

    const lowStockItems = useMemo(() =>
        products.filter(item => 
            !item.isDeleted && 
            !item.parentId && 
            item.trackInventory !== false && 
            item.category !== 'Drinks' && 
            item.stock <= (item.lowStockThreshold ?? 10)
        ),
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
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <CardTitle className="text-xl font-bold text-gray-900">Inventory Management</CardTitle>
                            <CardDescription>Track and manage your entire product catalog (Live)</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            {role === 'admin' && (
                                <Button
                                    variant="outline"
                                    onClick={() => setShowArchived(!showArchived)}
                                    className={`gap-2 h-9 text-xs font-semibold ${showArchived ? 'bg-purple-50 border-purple-200 text-purple-700' : 'text-gray-500'}`}
                                >
                                    <Archive className="w-4 h-4" />
                                    {showArchived ? 'Active Inventory' : 'View Archived'}
                                </Button>
                            )}
                            {role === 'admin' && showArchived && archivedItems.length > 0 && (
                                <Button
                                    variant="outline"
                                    onClick={() => setShowClearAllConfirm(true)}
                                    className="gap-2 h-9 text-xs font-semibold bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Clear All ({archivedItems.length})
                                </Button>
                            )}
                            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                                setIsAddDialogOpen(open);
                                if (!open) resetForm();
                            }}>
                                <DialogTrigger asChild>
                                    <Button onClick={handleOpenAdd} className="gap-2 h-9 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 shadow-sm text-white text-xs font-bold">
                                        <Plus className="w-4 h-4" /> Add Item
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">


                                        <div className="space-y-2">
                                            <Label>Product Category</Label>
                                            <div className="flex gap-2 p-1 bg-gray-100/80 rounded-lg">
                                                {['Scoops', 'Bio-products', 'Drinks', 'Popcorn'].map(cat => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => {
                                                            const isDrinks = cat === 'Drinks';
                                                            setFormData({
                                                                ...formData,
                                                                category: cat,
                                                                trackInventory: !isDrinks
                                                            });
                                                        }}
                                                        className={`flex-1 py-1.5 px-2 rounded-md text-[13px] font-medium transition-colors ${formData.category === cat ? 'bg-white text-gray-900 shadow-sm border border-gray-200/60' : 'text-gray-500 hover:text-gray-900'}`}
                                                    >
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="name">Item Name</Label>
                                            <Input
                                                id="name"
                                                value={formData.name}
                                                className={formErrors.name ? 'border-red-500 ring-1 ring-red-500' : ''}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, name: e.target.value });
                                                    if (formErrors.name) setFormErrors({ ...formErrors, name: false });
                                                }}
                                            />
                                        </div>

                                        {(formData.category === 'Bio-products' || formData.category === 'Scoops' || formData.category === 'Drinks') && (
                                            <div className="space-y-2">
                                                <Label htmlFor="subcategory">Subcategory</Label>
                                                <Input
                                                    id="subcategory"
                                                    value={formData.subcategory || ''}
                                                    onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                                                />
                                            </div>
                                        )}

                                        <Separator />

                                        {formData.category === 'Popcorn' ? (
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Boxes className="w-4 h-4 text-purple-600" />
                                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Box & Stock Details</span>
                                                </div>
                                                {editingItem ? (
                                                    <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl space-y-4">
                                                        <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                                                            <AlertTriangle className="w-4 h-4" />
                                                            Inventory Override
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-4">
                                                            <div className="space-y-1.5">
                                                                <Label className="text-rose-800 text-[11px] uppercase font-bold">Total Grams in Stock</Label>
                                                                <Input
                                                                    type="number"
                                                                    step="1"
                                                                    value={formData.stock}
                                                                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                                                    className="h-9 bg-white border-rose-200 font-bold text-rose-700 focus:ring-rose-500"
                                                                    title={`Equivalent to approx. ${(parseFloat(formData.stock) / (parseFloat(formData.boxWeight) || 3600)).toFixed(1)} boxes.`}
                                                                />
                                                                <p className="text-[10px] text-rose-500 font-medium italic">
                                                                    ≈ {(parseFloat(formData.stock) / (parseFloat(formData.boxWeight) || 3600)).toFixed(1)} Boxes visually based on {formData.boxWeight}g/box
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <p className="text-[10px] text-rose-600 leading-tight">
                                                            Warning: Manually overriding stock will affect inventory counts. For packaging changes, see the Specs section below.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl border-dashed">
                                                        <div className="flex flex-col items-center text-center gap-2">
                                                            <div className="p-2 bg-slate-100 rounded-full">
                                                                <Info className="w-4 h-4 text-slate-400" />
                                                            </div>
                                                            <p className="text-xs font-medium text-slate-500">
                                                                You are setting up the product information. <br/>
                                                                You can add <b>Stock</b> and <b>Box Weights</b> later via the <span className="text-purple-600 font-bold">Restock</span> button.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                <Separator />

                                                <div className="grid grid-cols-2 gap-6">
                                                    {/* Half Serving */}
                                                    <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Half Serving</Badge>
                                                            {formData.tubCost && formData.halfServingSize && (
                                                                <span className="text-[10px] font-bold text-blue-600">
                                                                    Approx Cost: {formData.tubCost && (parseFloat(formData.boxWeight) || (editingItem ? products.find(p => p.id === (editingItem.parentId || editingItem.id))?.yield : null)) ? 
                                                                        Math.round((parseFloat(formData.tubCost) / (parseFloat(formData.boxWeight) || products.find(p => p.id === (editingItem!.parentId || editingItem!.id))?.yield || 10000)) * parseFloat(formData.halfServingSize)) 
                                                                        : '0'} Nrs
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[11px] text-blue-800">Serving Weight (g)</Label>
                                                            <Input
                                                                type="number"
                                                                placeholder="200"
                                                                value={formData.halfServingSize}
                                                                onChange={(e) => setFormData({ ...formData, halfServingSize: e.target.value })}
                                                                className="h-8 bg-white border-blue-200"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[11px] text-blue-800">Selling Price</Label>
                                                            <Input
                                                                type="number"
                                                                placeholder="250"
                                                                value={formData.halfPrice}
                                                                onChange={(e) => setFormData({ ...formData, halfPrice: e.target.value })}
                                                                className="h-8 bg-white border-blue-200"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Full Serving */}
                                                    <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none">Full Serving</Badge>
                                                            {formData.tubCost && formData.fullServingSize && (
                                                                <span className="text-[10px] font-bold text-purple-600">
                                                                    Approx Cost: {formData.tubCost && (parseFloat(formData.boxWeight) || (editingItem ? products.find(p => p.id === (editingItem.parentId || editingItem.id))?.yield : null)) ? 
                                                                        Math.round((parseFloat(formData.tubCost) / (parseFloat(formData.boxWeight) || products.find(p => p.id === (editingItem!.parentId || editingItem!.id))?.yield || 10000)) * parseFloat(formData.fullServingSize)) 
                                                                        : '0'} Nrs
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[11px] text-purple-800">Serving Weight (g)</Label>
                                                            <Input
                                                                type="number"
                                                                placeholder="400"
                                                                value={formData.fullServingSize}
                                                                onChange={(e) => setFormData({ ...formData, fullServingSize: e.target.value })}
                                                                className="h-8 bg-white border-purple-200"
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <Label className="text-[11px] text-purple-800">Selling Price</Label>
                                                            <Input
                                                                type="number"
                                                                placeholder="450"
                                                                value={formData.fullPrice}
                                                                onChange={(e) => setFormData({ ...formData, fullPrice: e.target.value })}
                                                                className="h-8 bg-white border-purple-200"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-4">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-[11px] text-gray-600 uppercase font-bold">Low Stock Alert (total grams)</Label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value={formData.lowStockThreshold}
                                                            onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                                                            className="h-8 bg-white border-gray-200"
                                                        />
                                                        <p className="text-[10px] text-gray-400 italic">
                                                            Alerts when total stock drops below this weight (e.g., 3600 for 1 box).
                                                        </p>
                                                    </div>
                                                </div>

                                                {editingItem && (
                                                    <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                                                        <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase">
                                                            <Boxes className="w-3 h-3" />
                                                            Product Packaging Specs
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] text-slate-600">Box Weight (grams)</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={formData.boxWeight}
                                                                    onChange={(e) => setFormData({ ...formData, boxWeight: e.target.value })}
                                                                    className="h-8 bg-white"
                                                                />
                                                                <p className="text-[9px] text-slate-400 italic">Used for cost math</p>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[10px] text-slate-600">Box Cost (Nrs)</Label>
                                                                <Input
                                                                    type="number"
                                                                    value={formData.tubCost}
                                                                    onChange={(e) => setFormData({ ...formData, tubCost: e.target.value })}
                                                                    className="h-8 bg-white font-medium"
                                                                />
                                                                <p className="text-[9px] text-slate-400 italic">Last Purchase Price</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (formData.category === 'Scoops') ? (
                                            <>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Boxes className="w-4 h-4 text-purple-600" />
                                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Portion / Bulk Tracking</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2"><Label>Cost/Bulk (Box/Tub)</Label><Input type="number" min="0" value={formData.tubCost} onChange={(e) => setFormData({ ...formData, tubCost: e.target.value })} /></div>
                                                    <div className="space-y-2"><Label>Yield (Units/Box)</Label><Input type="number" value={formData.tubYield} onChange={(e) => setFormData({ ...formData, tubYield: e.target.value })} /></div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2"><Label>Selling Price/Unit</Label><Input type="number" min="0" step="1" className={formErrors.price ? 'border-red-500 ring-1 ring-red-500' : ''} value={formData.price} onChange={(e) => { setFormData({ ...formData, price: e.target.value }); if (formErrors.price) setFormErrors({ ...formErrors, price: false }); }} /></div>
                                                    <div className="space-y-2"><Label>Low Stock Alert</Label><Input type="number" min="0" step="1" value={formData.lowStockThreshold} onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })} /></div>
                                                </div>
                                                {editingItem && formData.trackInventory && (
                                                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg mt-2">
                                                        <Label className="text-red-700 block mb-2 font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Override Stock (Units)</Label>
                                                        <Input type="number" min="0" step="1" className={formErrors.stock ? 'border-red-500 ring-1 ring-red-500 font-bold bg-white' : 'font-bold bg-white'} value={formData.stock} onChange={(e) => { setFormData({ ...formData, stock: e.target.value }); if (formErrors.stock) setFormErrors({ ...formErrors, stock: false }); }} />
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2"><Label>Cost Price / Unit</Label><Input type="number" min="0" step="1" value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })} /></div>
                                                    <div className="space-y-2"><Label>Selling Price</Label><Input type="number" min="0" step="1" className={formErrors.price ? 'border-red-500 ring-1 ring-red-500' : ''} value={formData.price} onChange={(e) => { setFormData({ ...formData, price: e.target.value }); if (formErrors.price) setFormErrors({ ...formErrors, price: false }); }} /></div>
                                                </div>
                                                {formData.trackInventory && formData.category !== 'Drinks' && (
                                                    <>
                                                        <div className="space-y-2"><Label>Low Stock Alert</Label><Input type="number" min="0" step="1" value={formData.lowStockThreshold} onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })} /></div>
                                                        {editingItem && (
                                                            <div className="p-3 bg-red-50 border border-red-100 rounded-lg mt-2">
                                                                <Label className="text-red-700 block mb-2 font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Override Stock</Label>
                                                                <Input type="number" min="0" step="1" className={formErrors.stock ? 'border-red-500 ring-1 ring-red-500 font-bold bg-white' : 'font-bold bg-white'} value={formData.stock} onChange={(e) => { setFormData({ ...formData, stock: e.target.value }); if (formErrors.stock) setFormErrors({ ...formErrors, stock: false }); }} />
                                                            </div>
                                                        )}
                                                    </>
                                                )}
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
                    <div className="relative">
                        <Input 
                            placeholder="Search products..." 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                            className="max-w-sm h-9 bg-gray-50 border-transparent focus:bg-white transition-all text-sm pl-9"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table 
                        containerClassName="max-h-[calc(100vh-280px)] overflow-y-auto relative scrollbar-thin scrollbar-thumb-slate-200 border-t"
                        className="min-w-[600px] border-separate border-spacing-0"
                    >
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="sticky top-0 z-20 bg-gray-50 py-3 font-extrabold text-gray-900 border-b border-gray-200 uppercase tracking-wider text-[10px]">Item Name</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-gray-50 py-3 font-extrabold text-gray-900 border-b border-gray-200 uppercase tracking-wider text-[10px]">Category</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-gray-50 py-3 font-extrabold text-gray-900 border-b border-gray-200 uppercase tracking-wider text-[10px] text-right">Stock</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-gray-50 py-3 font-extrabold text-gray-900 border-b border-gray-200 uppercase tracking-wider text-[10px] text-right">Selling Price</TableHead>
                                <TableHead className="sticky top-0 z-20 bg-gray-50 py-3 font-extrabold text-gray-900 border-b border-gray-200 uppercase tracking-wider text-[10px] text-center w-[160px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                            <TableBody>
                                {filteredInventory.map(item => {
                                    // Check if this is a Popcorn STOCK parent
                                    const isPopcornParent = item.category === 'Popcorn' && item.name.includes('(STOCK)');
                                    const popcornVariants = isPopcornParent 
                                        ? products.filter(v => v.parentId === item.id && !v.isDeleted)
                                        : [];

                                    return (
                                        <>
                                        {/* ── Main Row ── */}
                                        <TableRow key={item.id} className={`${item.isDeleted ? 'opacity-60 bg-slate-50' : ''} ${isPopcornParent ? 'bg-purple-50/30 border-b-0 cursor-pointer hover:bg-purple-50/60 transition-colors' : ''}`}
                                            onClick={isPopcornParent ? () => setExpandedPopcorn(prev => {
                                                const next = new Set(prev);
                                                if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                                return next;
                                            }) : undefined}
                                        >
                                            <TableCell className="font-medium">
                                                {isPopcornParent ? (
                                                    <div className="flex items-center gap-2">
                                                        {expandedPopcorn.has(item.id) 
                                                            ? <ChevronDown className="w-4 h-4 text-purple-400 transition-transform" />
                                                            : <ChevronRight className="w-4 h-4 text-purple-400 transition-transform" />
                                                        }
                                                        <Boxes className="w-4 h-4 text-purple-500" />
                                                        <span className="font-bold text-purple-800">{item.name.replace(' (STOCK)', '')}</span>
                                                        <Badge className="bg-purple-100 text-purple-600 border-none text-[10px] px-1.5 py-0">Bulk</Badge>
                                                        <span className="text-[10px] text-slate-400 ml-1">({popcornVariants.length} variants)</span>
                                                    </div>
                                                ) : item.name}
                                            </TableCell>
                                            <TableCell>{item.category}</TableCell>
                                            <TableCell className="text-right">
                                                {(() => {
                                                    if (item.trackInventory === false) {
                                                        return (
                                                            <span className="text-slate-400 font-medium text-sm border-b border-dashed border-slate-300 pb-0.5" title="Inventory not tracked">
                                                                Untracked
                                                            </span>
                                                        );
                                                    }

                                                    // Popcorn STOCK parent: show grams + boxes
                                                    if (isPopcornParent) {
                                                        const grams = item.stock;
                                                        const boxes = item.yield ? (grams / item.yield).toFixed(1) : '?';
                                                        if (grams <= 0) {
                                                            return (
                                                                <Badge variant="destructive" className="animate-pulse bg-red-100 text-red-700 border border-red-200 shadow-none">
                                                                    Out of Stock
                                                                </Badge>
                                                            );
                                                        }
                                                        return (
                                                            <div className="flex flex-col items-end gap-0.5">
                                                                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-none font-bold">
                                                                    {grams.toLocaleString()}g
                                                                </Badge>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">≈ {boxes} boxes</span>
                                                            </div>
                                                        );
                                                    }

                                                    const parentProduct = item.parentId ? products.find(p => p.id === item.parentId) : null;
                                                    const displayStock = parentProduct
                                                        ? Math.floor(parentProduct.stock / (item.stockMultiplier || 1))
                                                        : item.stock;

                                                    if (displayStock <= 0) {
                                                        return (
                                                            <Badge variant="destructive" className="animate-pulse bg-red-100 text-red-700 border border-red-200 shadow-none">
                                                                Out of Stock
                                                            </Badge>
                                                        );
                                                    }

                                                    const unitLabel = item.category === 'Scoops' ? 'scoops' : (item.unit || 'pcs');

                                                    if (displayStock <= Math.max(1, Math.floor((item.lowStockThreshold ?? 10) / 2))) {
                                                        return (
                                                            <Badge className="bg-red-50 text-red-600 border border-red-200 shadow-none font-bold">
                                                                {displayStock} {unitLabel} ⚠️
                                                            </Badge>
                                                        );
                                                    }
                                                    if (displayStock <= (item.lowStockThreshold ?? 10)) {
                                                        return (
                                                            <Badge className="bg-amber-50 text-amber-700 border border-amber-200 shadow-none font-bold">
                                                                {displayStock} {unitLabel}
                                                            </Badge>
                                                        );
                                                    }
                                                    return (
                                                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-none font-bold">
                                                            {displayStock} {unitLabel}
                                                        </Badge>
                                                    );
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {isPopcornParent ? (
                                                    <span className="text-xs text-slate-400">—</span>
                                                ) : (
                                                    `Nrs.${item.price}`
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {item.isDeleted ? (
                                                        <>
                                                            <Button variant="ghost" size="sm" onClick={() => handleRestoreItem(item)} className="text-green-600 hover:text-green-700 hover:bg-green-50" title="Restore Item"><RefreshCcw className="w-4 h-4" /></Button>
                                                            <Button variant="ghost" size="sm" onClick={() => handlePermanentDelete(item)} className="text-red-500 hover:text-red-700 hover:bg-red-50" title="Permanently Delete"><Trash2 className="w-4 h-4" /></Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button variant="ghost" size="sm" onClick={() => setLedgerProduct(item)} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50" title="View Daily Ledger"><History className="w-4 h-4" /></Button>

                                                             <Button variant="ghost" size="sm" onClick={() => handleOpenRestock(item)} className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" title="Quick Restock"><PackagePlus className="w-4 h-4" /></Button>
                                                            <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(item)} title="Edit Item"><Edit3 className="w-4 h-4" /></Button>
                                                            <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item)} className="text-red-500"><Trash2 className="w-4 h-4" /></Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>

                                        {/* ── Popcorn Variant Sub-Rows ── */}
                                        {isPopcornParent && expandedPopcorn.has(item.id) && popcornVariants.map(variant => {
                                            const unitsAvailable = Math.floor(item.stock / (variant.stockMultiplier || 1));
                                            return (
                                                <TableRow key={variant.id} className="bg-slate-50/50 border-b border-dashed border-slate-100">
                                                    <TableCell className="font-medium pl-10">
                                                        <div className="flex items-center gap-2">
                                                            <ChevronRight className="w-3 h-3 text-slate-300" />
                                                            <span className="text-sm text-slate-600">{variant.name.replace(' (STOCK)', '')}</span>
                                                            <span className="text-[10px] font-bold text-slate-400">({variant.stockMultiplier}g/serving)</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-slate-400">Variant</span>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {unitsAvailable <= 0 ? (
                                                            <Badge variant="destructive" className="animate-pulse bg-red-100 text-red-700 border border-red-200 shadow-none text-xs">
                                                                0 units
                                                            </Badge>
                                                        ) : unitsAvailable <= 5 ? (
                                                            <Badge className="bg-amber-50 text-amber-700 border border-amber-200 shadow-none font-bold text-xs">
                                                                {unitsAvailable} units ⚠️
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-blue-50 text-blue-700 border border-blue-200 shadow-none font-bold text-xs">
                                                                {unitsAvailable} units
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-sm">Nrs.{variant.price}</TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Button variant="ghost" size="sm" onClick={() => setLedgerProduct(variant)} className="text-purple-600 hover:text-purple-700 hover:bg-purple-50" title="View Daily Ledger"><History className="w-4 h-4" /></Button>
                                                            <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(variant)} title="Edit Variant"><Edit3 className="w-4 h-4" /></Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        </>
                                    );
                                })}
                            </TableBody>
                        </Table>
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
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <span className="text-sm font-medium text-slate-600">Current Stock</span>
                                <span className="text-lg font-black text-slate-800">
                                    {restockItem.category === 'Popcorn' 
                                        ? `${restockItem.stock}g` 
                                        : `${restockItem.stock} ${restockItem.category === 'Scoops' ? 'scoops' : (restockItem.unit || 'pcs')}`}
                                </span>
                            </div>

                            {restockItem.category === 'Scoops' ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Full Tubs</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={restockTubs}
                                                onChange={(e) => {
                                                    setRestockTubs(e.target.value);
                                                    const tubs = parseInt(e.target.value) || 0;
                                                    const extra = parseInt(restockExtraScoops) || 0;
                                                    const yld = parseInt(restockYield) || 24;
                                                    setRestockQty(tubs > 0 || extra > 0 ? (tubs * yld + extra).toString() : '');
                                                }}
                                                className="h-10 text-lg font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Extra Scoops</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={restockExtraScoops}
                                                onChange={(e) => {
                                                    setRestockExtraScoops(e.target.value);
                                                    const tubs = parseInt(restockTubs) || 0;
                                                    const extra = parseInt(e.target.value) || 0;
                                                    const yld = parseInt(restockYield) || 24;
                                                    setRestockQty(tubs > 0 || extra > 0 ? (tubs * yld + extra).toString() : '');
                                                }}
                                                className="h-10 text-lg font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-2">
                                        <Label className="text-xs font-bold text-amber-700 uppercase">Cost/Tub (Optional)</Label>
                                        <Input
                                            type="number"
                                            value={restockTubCost}
                                            placeholder={`Default: Nrs. ${((restockItem.costPrice || 0) * (parseFloat(restockYield) || 24)).toFixed(0)}`}
                                            onChange={(e) => setRestockTubCost(e.target.value)}
                                            className="h-9"
                                        />
                                    </div>
                                </div>
                            ) : restockItem.category === 'Popcorn' ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Boxes Received</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={restockPopcornBoxes}
                                                onChange={(e) => setRestockPopcornBoxes(e.target.value)}
                                                className="h-10 text-lg font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1.5 p-3 rounded-lg border border-slate-200 bg-slate-50">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Total Weight (g)</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={restockPopcornWeight}
                                                onChange={(e) => setRestockPopcornWeight(e.target.value)}
                                                className="h-10 text-lg font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Total Cost for these Boxes</Label>
                                        <Input
                                            type="number"
                                            value={restockTubCost}
                                            placeholder={`Default: Nrs. ${((parseFloat(restockPopcornBoxes) || 1) * (restockItem.tubCost || 0)).toFixed(0)}`}
                                            onChange={(e) => setRestockTubCost(e.target.value)}
                                            className="h-10 text-lg font-bold"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">Quantity to Add</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={restockQty}
                                        onChange={(e) => setRestockQty(e.target.value)}
                                        className="h-11 text-lg font-bold"
                                    />
                                </div>
                            )}

                            <Button
                                onClick={handleConfirmRestock}
                                disabled={
                                    (restockItem.category === 'Popcorn' 
                                       ? (!restockPopcornWeight || parseFloat(restockPopcornWeight) <= 0)
                                       : (!restockQty || (parseInt(restockQty) || 0) <= 0)) 
                                    || upsertMutation.isPending
                                }
                                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                            >
                                {upsertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Confirm Restock
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>



            {/* ── Daily Ledger Dialog ── */}
            <ProductDailyLedgerDialog
                product={ledgerProduct}
                onClose={() => setLedgerProduct(null)}
            />

            {/* ── Professional Delete Confirmation ── */}
            <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
                <AlertDialogContent className="border-rose-100">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-rose-700">
                            <AlertTriangle className="w-5 h-5" />
                            Archiving "{deletingItem?.name}"
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-600">
                            Are you absolutely sure? This will remove the item from active inventory and POS.
                            You can restore it later from the Archive view.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="border-slate-200 text-slate-500 hover:bg-slate-50">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-100"
                        >
                            Yes, Archive Item
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Permanent Delete Confirmation ── */}
            <AlertDialog open={!!permanentDeleteItem} onOpenChange={(open) => !open && setPermanentDeleteItem(null)}>
                <AlertDialogContent className="border-red-200">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-700">
                            <Trash2 className="w-5 h-5" />
                            Permanently Delete "{permanentDeleteItem?.name}"?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-600 space-y-2">
                            <p>This action <strong>cannot be undone</strong>. The item will be permanently removed from the database.</p>
                            <p className="text-xs text-slate-400">Note: Past order history referencing this item will not be affected — order records store item details independently.</p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="border-slate-200 text-slate-500 hover:bg-slate-50">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmPermanentDelete}
                            className="bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-100"
                        >
                            Yes, Permanently Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Clear All Archived Confirmation ── */}
            <AlertDialog open={showClearAllConfirm} onOpenChange={setShowClearAllConfirm}>
                <AlertDialogContent className="border-red-200">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-700">
                            <Trash2 className="w-5 h-5" />
                            Clear All Archived Products?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-600 space-y-2">
                            <p>This will <strong>permanently delete {archivedItems.length} archived products</strong> from the database. This action <strong>cannot be undone</strong>.</p>
                            <p className="text-xs text-slate-400">Note: Past order history will not be affected — order records store item details independently.</p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel className="border-slate-200 text-slate-500 hover:bg-slate-50">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmClearAllArchived}
                            className="bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-100"
                        >
                            Yes, Delete All {archivedItems.length} Items
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
