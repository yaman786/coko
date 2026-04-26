import { useState, useEffect } from 'react';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Truck, Plus, Search, Building2, ArrowUpRight, Trash2, Edit2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { api } from '../../services/api';
import { toast } from 'sonner';
import type { Supplier } from '../../types';
import { SupplierLedger } from '../../features/suppliers/components/SupplierLedger';
import { AddSupplierDialog } from '../../features/suppliers/components/AddSupplierDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../components/ui/alert-dialog';

export default function WholesaleSuppliersPage() {
    // Hard-coded to Wholesale - No 'isWholesale' logic needed
    const currentPortal = 'wholesale';
    usePageTitle('Suppliers', 'GOD');

    // Industry Standard Sky-Blue Theme for Wholesale
    const theme = {
        primary: 'sky-600',
        hover: 'hover:bg-sky-700',
        bg: 'bg-sky-600',
        shadow: 'shadow-sky-100',
        text: 'text-sky-600',
        iconBg: 'bg-sky-50'
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
            console.error('Failed to fetch wholesale suppliers:', error);
            toast.error('Failed to load supplier network');
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const handleDelete = async () => {
        if (!supplierToDelete) return;
        try {
            await api.deleteSupplier(supplierToDelete.id);
            toast.success('Supplier removed from GOD network');
            fetchSuppliers();
        } catch (error) {
            toast.error('Failed to remove supplier');
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
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header section with Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-2">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-black tracking-tight text-slate-800 font-['DM_Sans',sans-serif] flex items-center gap-4">
                        <div className={`w-12 h-12 ${theme.bg} rounded-2xl flex items-center justify-center shadow-xl ${theme.shadow}/50`}>
                            <Truck className="w-6 h-6 text-white" />
                        </div>
                        <span className={theme.text}>Wholesale</span> Partner Hub
                    </h1>
                    <p className="text-slate-500 font-medium font-['DM_Sans',sans-serif] ml-16">Intelligence unit for bulk vendor relations and capital flow.</p>
                </div>
                
                <Card className="bg-white/40 backdrop-blur-3xl border-slate-200/60 shadow-2xl rounded-[2rem] min-w-[320px] hover:shadow-xl transition-all duration-500 hover:-translate-y-1 border">
                    <CardContent className="p-6 flex items-center gap-6">
                        <div className="w-16 h-16 rounded-[1.25rem] bg-sky-100 flex items-center justify-center border border-sky-200/50 shadow-inner">
                            <ArrowUpRight className="w-8 h-8 text-sky-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">Total Wholesale Liability</p>
                            <p className="text-3xl font-black text-rose-600 tracking-tight font-['DM_Sans',sans-serif] mt-1">
                                Rs. {totalOwed.toLocaleString()}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                        placeholder="Search wholesale network..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-14 h-14 bg-white/80 backdrop-blur-xl border-slate-200/60 rounded-full focus:ring-4 focus:ring-sky-500/10 shadow-sm font-['DM_Sans',sans-serif] text-sm font-medium transition-all"
                    />
                </div>
                <Button 
                    onClick={() => {
                        setEditingSupplier(null);
                        setIsAddOpen(true);
                    }}
                    className={`${theme.bg} ${theme.hover} text-white px-10 h-14 rounded-full font-black font-['DM_Sans',sans-serif] text-[10px] uppercase tracking-widest shadow-xl shadow-sky-500/10 transition-all duration-300 hover:scale-[1.02] flex items-center gap-3 w-full sm:w-auto`}
                >
                    <Plus className="w-5 h-5" />
                    Onboard GOD Partner
                </Button>
            </div>

            {/* Suppliers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredSuppliers.map((supplier) => (
                    <Card 
                        key={supplier.id} 
                        className="group bg-white/40 backdrop-blur-3xl border-slate-200/60 rounded-[2rem] overflow-hidden hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 cursor-pointer relative shadow-xl border"
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

                            <div className="flex flex-col gap-1">
                                <h3 className="text-2xl font-black text-slate-800 font-['DM_Sans',sans-serif] tracking-tight group-hover:text-sky-600 transition-colors">{supplier.name}</h3>
                                {supplier.contact_person && (
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-['DM_Sans',sans-serif]">{supplier.contact_person}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100/50">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-['DM_Sans',sans-serif]">Phone</p>
                                    <p className="text-xs font-black text-slate-600 font-['DM_Sans',sans-serif] flex items-center gap-2 truncate">
                                        {supplier.phone || '-'}
                                    </p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-['DM_Sans',sans-serif]">Liability</p>
                                    <p className={`text-xl font-black font-['DM_Sans',sans-serif] ${supplier.current_balance > 0 ? 'text-rose-600 font-black' : 'text-emerald-600'}`}>
                                        Rs. {supplier.current_balance.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                        <div className={`absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-sky-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
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
                        <AlertDialogTitle>Remove Wholesale Partner?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove **{supplierToDelete?.name}** from the Wholesale network. This action cannot be undone.
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
