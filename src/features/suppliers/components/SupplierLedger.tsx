import { useState, useEffect } from 'react';
import { ArrowLeft, PlusCircle, Search, FileText, Trash2, Calendar, CreditCard, Receipt } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card } from '../../../components/ui/card';
import { api } from '../../../services/api';
import { toast } from 'sonner';
import type { Supplier, SupplierTransaction } from '../../../types';
import { RecordTransactionDialog } from './RecordTransactionDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../../components/ui/alert-dialog';

interface SupplierLedgerProps {
    supplier: Supplier;
    onBack: () => void;
    onRefreshSupplier: () => void;
}

export function SupplierLedger({ supplier, onBack, onRefreshSupplier }: SupplierLedgerProps) {
    const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRecordOpen, setIsRecordOpen] = useState(false);
    const [txToDelete, setTxToDelete] = useState<SupplierTransaction | null>(null);

    const fetchTransactions = async () => {
        try {
            const data = await api.getSupplierTransactions(supplier.id);
            setTransactions(data);
        } catch (error) {
            console.error('Failed to fetch transactions:', error);
            toast.error('Failed to load ledger');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [supplier.id]);

    const handleDelete = async () => {
        if (!txToDelete) return;
        try {
            await api.deleteSupplierTransaction(txToDelete.id);
            toast.success('Transaction removed');
            fetchTransactions();
            onRefreshSupplier(); // Important to update the main balance
        } catch (error) {
            toast.error('Failed to delete transaction');
        } finally {
            setTxToDelete(null);
        }
    };

    const filteredTransactions = transactions.filter(t => 
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.reference_number?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-500">
            {/* Ledger Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onBack}
                        className="rounded-xl hover:bg-slate-100"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">{supplier.name}</h2>
                        <p className="text-slate-500 font-medium text-sm">Full transaction history and ledger.</p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Balance</p>
                        <p className={`text-xl font-black tracking-tight ${supplier.current_balance > 0 ? 'text-orange-600' : 'text-slate-900'}`}>
                            Nrs. {supplier.current_balance.toLocaleString()}
                        </p>
                    </div>
                    <Button 
                        onClick={() => setIsRecordOpen(true)}
                        className="bg-purple-600 hover:bg-purple-700 rounded-xl font-bold gap-2 px-6 h-11"
                    >
                        <PlusCircle className="w-5 h-5" />
                        Record Flow
                    </Button>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                        placeholder="Search by note or ref#..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-11 bg-white border-slate-200 rounded-xl"
                    />
                </div>
            </div>

            {/* Transaction List */}
            <Card className="border-slate-200/60 shadow-sm overflow-hidden bg-white rounded-3xl">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent border-slate-100">
                            <TableHead className="font-bold text-slate-500">Date</TableHead>
                            <TableHead className="font-bold text-slate-500">Type</TableHead>
                            <TableHead className="font-bold text-slate-500 text-right">Amount</TableHead>
                            <TableHead className="font-bold text-slate-500">Method</TableHead>
                            <TableHead className="font-bold text-slate-500">Note / Ref#</TableHead>
                            <TableHead className="w-12"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-40 text-center text-slate-400 font-medium">
                                    Loading ledger...
                                </TableCell>
                            </TableRow>
                        ) : filteredTransactions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-40 text-center">
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <FileText className="w-8 h-8 text-slate-200" />
                                        <p className="text-slate-500 font-medium">No transactions found for this period.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredTransactions.map((t) => (
                                <TableRow key={t.id} className="hover:bg-slate-50/50 border-slate-50 group">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            {new Date(t.date).toLocaleDateString()}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase border ${
                                            t.type === 'BILL' 
                                                ? 'bg-orange-50 text-orange-700 border-orange-100/50' 
                                                : 'bg-green-50 text-green-700 border-green-100/50'
                                        }`}>
                                            {t.type}
                                        </span>
                                    </TableCell>
                                    <TableCell className={`text-right font-bold ${t.type === 'BILL' ? 'text-slate-900' : 'text-green-600'}`}>
                                        {t.type === 'BILL' ? '+' : '-'} Nrs. {t.amount.toLocaleString()}
                                    </TableCell>
                                    <TableCell>
                                        {t.payment_method ? (
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                                <CreditCard className="w-3.5 h-3.5" />
                                                {t.payment_method}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-semibold text-slate-700 line-clamp-1">{t.description || 'No note'}</p>
                                            {t.reference_number && (
                                                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                    <Receipt className="w-3 h-3" />
                                                    {t.reference_number}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                            onClick={() => setTxToDelete(t)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            <RecordTransactionDialog 
                supplier={supplier}
                open={isRecordOpen}
                onOpenChange={setIsRecordOpen}
                onSuccess={() => {
                    fetchTransactions();
                    onRefreshSupplier();
                }}
            />

            <AlertDialog open={!!txToDelete} onOpenChange={() => setTxToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the record and re-calculate the supplier balance. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 font-bold">
                            Delete Permanent
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
