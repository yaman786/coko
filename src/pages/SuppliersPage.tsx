import { useState, useEffect } from 'react';
import { Truck, Plus, Search, Building2, Phone, ArrowUpRight, Trash2, Edit2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { api } from '../services/api';
import { toast } from 'sonner';
import type { Supplier } from '../types';
import { SupplierLedger } from '../features/suppliers/components/SupplierLedger';
import { AddSupplierDialog } from '../features/suppliers/components/AddSupplierDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';

export function SuppliersPage() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

    const fetchSuppliers = async () => {
        try {
            const data = await api.getSuppliers();
            setSuppliers(data);
        } catch (error) {
            console.error('Failed to fetch suppliers:', error);
            toast.error('Failed to load suppliers');
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const handleDelete = async () => {
        if (!supplierToDelete) return;
        try {
            await api.deleteSupplier(supplierToDelete.id);
            toast.success('Supplier removed');
            fetchSuppliers();
        } catch (error) {
            toast.error('Failed to delete supplier');
        } finally {
            setSupplierToDelete(null);
        }
    };

    const filteredSuppliers = suppliers.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.contact_person?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalOwed = suppliers.reduce((sum, s) => sum + s.current_balance, 0);

    // If a supplier is selected, show their detailed ledger
    if (selectedSupplier) {
        return (
            <div className="p-4 sm:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
                <SupplierLedger 
                    supplier={selectedSupplier} 
                    onBack={() => setSelectedSupplier(null)}
                    onRefreshSupplier={fetchSuppliers}
                />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header section with Stats */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                        <Truck className="w-8 h-8 text-purple-600" />
                        Suppliers
                    </h1>
                    <p className="text-slate-500 font-medium">Manage your vendor balances and financial history.</p>
                </div>
                
                <Card className="bg-white border-slate-200/60 shadow-sm min-w-[240px]">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center border border-orange-100/50">
                            <ArrowUpRight className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Owed</p>
                            <p className="text-2xl font-black text-slate-900 tracking-tight">
                                Nrs. {totalOwed.toLocaleString()}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:max-w-md group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-purple-500 transition-colors" />
                    <Input 
                        placeholder="Search vendors or contacts..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-11 bg-white border-slate-200 focus:border-purple-400 focus:ring-purple-100 rounded-xl transition-all"
                    />
                </div>
                <Button 
                    onClick={() => {
                        setEditingSupplier(null);
                        setIsAddOpen(true);
                    }}
                    className="w-full sm:w-auto h-11 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-100 flex items-center gap-2 font-bold"
                >
                    <Plus className="w-5 h-5" />
                    Add Vendor
                </Button>
            </div>

            {/* Main Listing */}
            {filteredSuppliers.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100">
                        <Building2 className="w-8 h-8 text-slate-300" />
                    </div>
                    <div>
                        <p className="text-lg font-bold text-slate-900">No suppliers found</p>
                        <p className="text-slate-500">Start by adding your first vendor to track balances.</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSuppliers.map((supplier) => (
                        <Card 
                            key={supplier.id} 
                            onClick={() => setSelectedSupplier(supplier)}
                            className="group hover:border-purple-200 transition-all hover:shadow-xl hover:shadow-purple-500/5 cursor-pointer relative overflow-hidden bg-white border-slate-200/80 rounded-2xl"
                        >
                            <CardContent className="p-6 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-lg text-slate-900">{supplier.name}</h3>
                                        <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
                                            <Building2 className="w-3.5 h-3.5" />
                                            {supplier.contact_person || 'No contact person'}
                                        </p>
                                    </div>
                                    <div className={`px-2.5 py-1 rounded-lg text-xs font-bold tracking-tight ${
                                        supplier.current_balance > 0 
                                            ? 'bg-orange-50 text-orange-700 border border-orange-100' 
                                            : 'bg-green-50 text-green-700 border border-green-100'
                                    }`}>
                                        {supplier.current_balance > 0 ? 'DUE' : 'CLEAR'}
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-slate-50">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-400 font-medium">Balance Owed</span>
                                        <span className={`font-black ${supplier.current_balance > 0 ? 'text-orange-600' : 'text-slate-600'}`}>
                                            Nrs. {supplier.current_balance.toLocaleString()}
                                        </span>
                                    </div>
                                    {supplier.phone && (
                                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                            <Phone className="w-3.5 h-3.5" />
                                            {supplier.phone}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="w-full rounded-lg font-bold border-slate-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-all"
                                    >
                                        View Ledger
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-9 w-9 text-slate-400 hover:text-blue-600 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingSupplier(supplier);
                                            setIsAddOpen(true);
                                        }}
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-9 w-9 text-slate-400 hover:text-red-500 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSupplierToDelete(supplier);
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <AddSupplierDialog 
                open={isAddOpen} 
                onOpenChange={setIsAddOpen} 
                onSuccess={fetchSuppliers}
                editingSupplier={editingSupplier}
            />

            <AlertDialog open={!!supplierToDelete} onOpenChange={() => setSupplierToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove **{supplierToDelete?.name}** and all their financial history. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 font-bold">
                            Remove Supplier
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
