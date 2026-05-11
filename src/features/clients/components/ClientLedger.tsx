import { useState } from 'react';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Phone, Mail, MapPin, History, Wallet, ChevronLeft, Edit2, Trash2, Calendar, ArrowUpRight, ArrowDownLeft, AlertCircle } from 'lucide-react';
import { AddClientDialog } from './AddClientDialog';
import { RecordTransactionDialog } from './RecordTransactionDialog';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Supplier, SupplierTransaction } from '../../../types';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "../../../components/ui/alert-dialog";

export function ClientLedger({ 
    supplier, 
    onBack, 
    onRefreshSupplier, 
    portal 
}: { 
    supplier: Supplier, 
    onBack: () => void, 
    onRefreshSupplier: () => void, 
    portal: 'retail' | 'wholesale' 
}) {
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<SupplierTransaction | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<SupplierTransaction | null>(null);

    const { data: transactions = [], refetch } = useQuery({
        queryKey: ['supplier-transactions', supplier.id],
        queryFn: () => api.getSupplierTransactions(supplier.id)
    });

    const sortedTransactions = [...transactions].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const handleOpenNewTransaction = () => {
        setEditingTransaction(null);
        setIsTransactionDialogOpen(true);
    };

    const handleEditTransaction = (t: SupplierTransaction) => {
        setEditingTransaction(t);
        setIsTransactionDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!transactionToDelete) return;

        setIsDeleting(true);
        try {
            await api.softDeleteSupplierTransaction(transactionToDelete.id);
            toast.success('Transaction deleted successfully');
            refetch();
            onRefreshSupplier();
        } catch (error) {
            console.error('Failed to delete transaction:', error);
            toast.error('Failed to delete transaction');
        } finally {
            setIsDeleting(false);
            setTransactionToDelete(null);
        }
    };

    return (
        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm flex flex-col rounded-[2rem] overflow-hidden min-h-[600px]">
            <CardHeader className="pb-4 border-b border-slate-100/50 bg-slate-50/30">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <Button variant="ghost" onClick={onBack} className="rounded-full h-10 w-10 p-0 mt-1">
                            <ChevronLeft className="w-6 h-6" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{supplier.name}</h2>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${supplier.current_balance > 0 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                    {supplier.current_balance > 0 ? 'Outstanding' : 'Balanced'}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs text-slate-500 font-medium">
                                <div className="flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5" /> {supplier.phone || 'N/A'}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5" /> {supplier.email || 'N/A'}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5" /> {supplier.address || 'N/A'}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={handleOpenNewTransaction}
                            className={`${portal === 'wholesale' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-purple-600 hover:bg-purple-700'} text-white rounded-xl font-bold shadow-lg shadow-blue-100`}
                        >
                            Record Payment
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setIsAddDialogOpen(true)}
                            className="rounded-xl border-slate-200"
                        >
                            Edit
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col p-6 space-y-6">
                <div className="flex justify-between items-center bg-slate-900/50 backdrop-blur-md p-6 rounded-2xl border border-white/10 shadow-xl">
                    <div>
                        <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Current Balance</h3>
                        <p className={`text-4xl font-bold mt-1 ${supplier.current_balance >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
                            Rs. {Math.abs(supplier.current_balance).toLocaleString()}
                            <span className="text-lg ml-2 font-medium">
                                {supplier.current_balance >= 0 ? 'To Pay' : 'Advanced'}
                            </span>
                        </p>
                    </div>
                    <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                        <AlertCircle className="w-8 h-8 text-amber-500" />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-4">
                        <History className="w-4 h-4 text-slate-400" />
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Activity History</h4>
                    </div>
                    <div className="space-y-3">
                        {sortedTransactions.map((transaction) => (
                            <div
                                key={transaction.id}
                                className="group relative flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-xl border border-slate-100 transition-all duration-300"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2.5 rounded-lg ${
                                        transaction.type === 'PAYMENT' 
                                            ? 'bg-emerald-50 text-emerald-600' 
                                            : 'bg-amber-50 text-amber-600'
                                    }`}>
                                        {transaction.type === 'PAYMENT' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-700">
                                            Rs. {transaction.amount.toLocaleString()}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            <span className="text-xs text-slate-500">
                                                {format(new Date(transaction.date), 'PPP')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 rounded-full hover:bg-amber-50 hover:text-amber-600"
                                        onClick={() => handleEditTransaction(transaction)}
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 rounded-full hover:bg-red-50 hover:text-red-600"
                                        onClick={() => setTransactionToDelete(transaction)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {sortedTransactions.length === 0 && (
                            <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                <p className="text-slate-400 font-medium">No transactions recorded yet</p>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>

            <AddClientDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
                onSuccess={() => {
                    refetch();
                    onRefreshSupplier();
                }}
                editingSupplier={supplier}
                portal={portal}
            />

            <RecordTransactionDialog
                open={isTransactionDialogOpen}
                onOpenChange={setIsTransactionDialogOpen}
                supplier={supplier}
                editingTransaction={editingTransaction}
                onSuccess={() => {
                    refetch();
                    onRefreshSupplier();
                }}
                portal={portal}
            />

            <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(null)}>
                <AlertDialogContent className="bg-white border-slate-200">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500">
                            This action cannot be undone. This will permanently delete the transaction
                            of <span className="text-slate-900 font-semibold">Rs. {transactionToDelete?.amount?.toLocaleString()}</span> and update the client's balance.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700 text-white border-none"
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}
