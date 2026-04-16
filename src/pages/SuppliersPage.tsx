import { useState, useEffect } from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
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
    const isWholesale = typeof window !== 'undefined' && window.location.pathname.startsWith('/wholesale');
    const currentPortal = isWholesale ? 'wholesale' : 'retail';
    usePageTitle('Suppliers', isWholesale ? 'GOD' : 'Coko');

    // Theme configuration
    const theme = {
        primary: isWholesale ? 'sky-600' : 'purple-600',
        hover: isWholesale ? 'hover:bg-sky-700' : 'hover:bg-purple-700',
        bg: isWholesale ? 'bg-sky-600' : 'bg-purple-600',
        shadow: isWholesale ? 'shadow-sky-100' : 'shadow-purple-100',
        text: isWholesale ? 'text-sky-600' : 'text-purple-600',
        iconBg: isWholesale ? 'bg-sky-50' : 'bg-purple-50'
    };
    
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

    const fetchSuppliers = async () => {
        try {
            const data = await api.getSuppliers(currentPortal);
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
                    portal={currentPortal}
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
                        <Truck className={`w-8 h-8 ${theme.text}`} />
                        Suppliers
                    </h1>
                    <p className="text-slate-500 font-medium">Manage your vendor balances and financial history.</p>
                </div>
                
                <Card className="bg-white/80 backdrop-blur-2xl border-slate-200/60 shadow-xl rounded-3xl min-w-[320px] hover:shadow-2xl transition-all duration-500 hover:-translate-y-1">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center border border-orange-100/50 shadow-inner">
                            <ArrowUpRight className="w-8 h-8 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Total Owed</p>
                            <p className="text-3xl font-black text-rose-600 tracking-tighter font-['DM_Sans',sans-serif] mt-1">
                                Nrs. {totalOwed.toLocaleString()}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-6 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                        placeholder="Search vendors..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-13 h-14 bg-white/80 backdrop-blur-xl border-slate-200/60 rounded-full focus:ring-4 focus:ring-purple-500/10 shadow-sm font-['DM_Sans',sans-serif] text-base font-medium"
                    />
                </div>
                <Button 
                    onClick={() => {
                        setEditingSupplier(null);
                        setIsAddOpen(true);
                    }}
                    className={`${theme.bg} ${theme.hover} text-white px-8 h-14 rounded-full font-black font-['DM_Sans',sans-serif] text-base shadow-xl transition-all duration-300 hover:scale-[1.02] flex items-center gap-3 w-full sm:w-auto`}
                >
                    <Plus className="w-5 h-5" />
                    Add Vendor
                </Button>
            </div>

            {/* Suppliers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredSuppliers.map((supplier) => (
                    <Card 
                        key={supplier.id} 
                        className="group bg-white/80 backdrop-blur-xl border-slate-200/60 rounded-[2.5rem] overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 cursor-pointer relative shadow-sm"
                        onClick={() => setSelectedSupplier(supplier)}
                    >
                        <CardContent className="p-8 space-y-6">
                            <div className="flex justify-between items-start">
                                <div className={`w-16 h-16 rounded-[1.25rem] ${theme.iconBg} flex items-center justify-center border border-${theme.primary}/10 group-hover:rotate-12 transition-transform duration-500`}>
                                    <Building2 className={`w-8 h-8 ${theme.text}`} />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-10 w-10 rounded-full bg-slate-100/50 hover:bg-white text-slate-500 hover:text-blue-600 shadow-sm border border-slate-200/50"
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
                                        className="h-10 w-10 rounded-full bg-slate-100/50 hover:bg-white text-slate-500 hover:text-rose-600 shadow-sm border border-slate-200/50"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSupplierToDelete(supplier);
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-2xl font-black text-slate-900 font-['DM_Sans',sans-serif] tracking-tight group-hover:text-purple-600 transition-colors">{supplier.name}</h3>
                                {supplier.contact_person && (
                                    <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] font-['DM_Sans',sans-serif] mt-1">{supplier.contact_person}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-['DM_Sans',sans-serif]">Contact</p>
                                    <p className="text-sm font-black text-slate-700 font-['DM_Sans',sans-serif] flex items-center gap-2 truncate">
                                        <Phone className="w-3.5 h-3.5 text-slate-300" />
                                        {supplier.phone || '-'}
                                    </p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-['DM_Sans',sans-serif]">Balance</p>
                                    <p className={`text-lg font-black font-['DM_Sans',sans-serif] ${supplier.current_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        Nrs. {supplier.current_balance.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                        <div className={`absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-${theme.primary}/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                    </Card>
                ))}

                {filteredSuppliers.length === 0 && (
                    <div className="col-span-full py-24 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                            <Truck className="w-12 h-12 text-slate-200" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl font-bold text-slate-400 font-['DM_Sans',sans-serif]">No vendors found</h3>
                            <p className="text-slate-300 font-medium font-['DM_Sans',sans-serif]">Try adjusting your search query</p>
                        </div>
                    </div>
                )}
            </div>

            <AddSupplierDialog 
                open={isAddOpen} 
                onOpenChange={setIsAddOpen} 
                onSuccess={fetchSuppliers}
                editingSupplier={editingSupplier}
                portal={currentPortal}
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
