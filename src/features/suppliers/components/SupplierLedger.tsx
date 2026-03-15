import { useState, useEffect } from 'react';
import { ArrowLeft, PlusCircle, Search, Edit2, Trash2, Calendar, CreditCard, Receipt, Download, Paperclip, FileText } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card } from '../../../components/ui/card';
import { api } from '../../../services/api';
import { toast } from 'sonner';
import type { Supplier, SupplierTransaction } from '../../../types';
import { RecordTransactionDialog } from './RecordTransactionDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../../components/ui/alert-dialog';
import { exportSupplierLedgerToPDF, exportToCSV } from '../../../utils/export';
import { useAuth } from '../../../contexts/AuthContext';
import { DropdownMenu } from '../../../components/ui/DropdownMenu';
import { FileText as FileIcon, Table as CsvIcon } from 'lucide-react';

interface SupplierLedgerProps {
    supplier: Supplier;
    onBack: () => void;
    onRefreshSupplier: () => void;
}

export function SupplierLedger({ supplier, onBack, onRefreshSupplier }: SupplierLedgerProps) {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRecordOpen, setIsRecordOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<SupplierTransaction | null>(null);
    const [txToDelete, setTxToDelete] = useState<SupplierTransaction | null>(null);
    const [showDeleted, setShowDeleted] = useState(false);

    const fetchTransactions = async () => {
        try {
            const data = await api.getSupplierTransactions(supplier.id, showDeleted);
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
    }, [supplier.id, showDeleted]);

    const handleDelete = async () => {
        if (!txToDelete) return;
        try {
            await api.softDeleteSupplierTransaction(txToDelete.id);
            toast.success('Transaction archived');
            fetchTransactions();
            onRefreshSupplier();
        } catch (error) {
            toast.error('Failed to archive transaction');
        } finally {
            setTxToDelete(null);
        }
    };

    const handleRestore = async (id: string) => {
        try {
            await api.restoreSupplierTransaction(id);
            toast.success('Transaction restored');
            fetchTransactions();
            onRefreshSupplier();
        } catch (error) {
            toast.error('Failed to restore');
        }
    };

    const handleExportPDF = () => {
        const exportData = {
            supplier: {
                name: supplier.name,
                phone: supplier.phone,
                address: supplier.address,
                current_balance: supplier.current_balance
            },
            transactions: transactions.map(t => ({
                date: t.date.toString(),
                type: t.type,
                amount: t.amount,
                description: t.description,
                reference: t.reference_number,
                author: t.created_by,
                is_deleted: t.is_deleted
            })),
            adminName: user?.email?.split('@')[0] || 'Admin'
        };
        exportSupplierLedgerToPDF(exportData);
    };

    const handleExportCSV = () => {
        const csvData = transactions.map(t => ({
            Date: new Date(t.date).toLocaleDateString(),
            Type: t.type,
            Amount: t.amount,
            Note: t.description || '',
            Reference: t.reference_number || '',
            RecordedBy: t.created_by || 'Unknown',
            Status: t.is_deleted ? 'Archived' : 'Active'
        }));
        exportToCSV(csvData, `ledger-${supplier.name.toLowerCase().replace(/\s+/g, '-')}`);
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
                    <div className="flex items-center gap-2">
                        <DropdownMenu
                            buttonContent={
                                <>
                                    <Download className="h-4 w-4" />
                                    Statement
                                </>
                            }
                            buttonClassName="bg-white rounded-xl border-slate-200 font-bold text-slate-700 hover:bg-slate-50 gap-2 shadow-sm h-11 px-4 ring-0"
                            items={[
                                {
                                    label: 'Export PDF',
                                    icon: FileIcon,
                                    onClick: handleExportPDF,
                                    className: 'font-bold text-slate-700'
                                },
                                {
                                    label: 'Export CSV',
                                    icon: CsvIcon,
                                    onClick: handleExportCSV,
                                    className: 'font-bold text-slate-700'
                                }
                            ]}
                        />
                        <Button 
                            onClick={() => {
                                setEditingTransaction(null);
                                setIsRecordOpen(true);
                            }}
                            className="bg-purple-600 hover:bg-purple-700 rounded-xl font-bold gap-2 px-6 h-11"
                        >
                            <PlusCircle className="w-5 h-5" />
                            Record Flow
                        </Button>
                    </div>
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
                <Button 
                    variant={showDeleted ? "secondary" : "outline"}
                    onClick={() => setShowDeleted(!showDeleted)}
                    className="rounded-xl font-bold gap-2 h-11"
                >
                    <Trash2 className="w-4 h-4" />
                    {showDeleted ? "Hide Archived" : "Show Archived"}
                </Button>
            </div>

            {/* Transaction List */}
            <Card className="border-slate-200/60 shadow-sm overflow-hidden bg-white rounded-3xl">
                <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow className="hover:bg-transparent border-slate-100">
                                <TableHead className="font-bold text-slate-500">Date</TableHead>
                                <TableHead className="font-bold text-slate-500">Type</TableHead>
                                <TableHead className="font-bold text-slate-500">Recorded By</TableHead>
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
                                <TableRow key={t.id} className={`hover:bg-slate-50/50 border-slate-50 group ${t.is_deleted ? 'opacity-50 bg-slate-50 italic' : ''}`}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            {new Date(t.date).toLocaleDateString()}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase border w-fit ${
                                                t.type === 'BILL' 
                                                    ? 'bg-orange-50 text-orange-700 border-orange-100/50' 
                                                    : 'bg-green-50 text-green-700 border-green-100/50'
                                            }`}>
                                                {t.type}
                                            </span>
                                            {t.type === 'BILL' && t.due_date && !t.is_deleted && (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    {(() => {
                                                        const dueDate = new Date(t.due_date);
                                                        const today = new Date();
                                                        today.setHours(0, 0, 0, 0);
                                                        const diffTime = dueDate.getTime() - today.getTime();
                                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                        
                                                        if (diffDays < 0) {
                                                            return <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">OVERDUE ({Math.abs(diffDays)}d)</span>;
                                                        } else if (diffDays <= 3) {
                                                            return <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">DUE IN {diffDays}d</span>;
                                                        } else {
                                                            return <span className="text-[9px] font-bold text-slate-400">Due {new Date(t.due_date).toLocaleDateString()}</span>;
                                                        }
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-400 font-medium">
                                        {t.created_by || 'Unknown'}
                                    </TableCell>
                                    <td className={`p-4 text-right font-bold ${t.is_deleted ? 'text-slate-400' : (t.type === 'BILL' ? 'text-slate-900' : 'text-green-600')}`}>
                                        {t.type === 'BILL' ? '+' : '-'} Nrs. {t.amount.toLocaleString()}
                                    </td>
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
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="space-y-0.5">
                                                <p className="text-sm font-semibold text-slate-700 line-clamp-1">{t.description || 'No note'}</p>
                                                {t.reference_number && (
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                        <Receipt className="w-3 h-3" />
                                                        {t.reference_number}
                                                    </div>
                                                )}
                                            </div>
                                            {t.attachment_url && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => window.open(t.attachment_url, '_blank')}
                                                    className="h-7 px-2 text-[10px] font-bold gap-1.5 border-orange-100 bg-orange-50/50 text-orange-600 hover:bg-orange-100 hover:text-orange-700 rounded-lg shrink-0"
                                                >
                                                    <Paperclip className="w-3 h-3" />
                                                    View Receipt
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {t.is_deleted ? (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                                                    onClick={() => handleRestore(t.id)}
                                                    title="Restore Transaction"
                                                >
                                                    <PlusCircle className="w-4 h-4" />
                                                </Button>
                                            ) : (
                                                <>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-slate-100"
                                                        onClick={() => {
                                                            setEditingTransaction(t);
                                                            setIsRecordOpen(true);
                                                        }}
                                                        title="Edit Transaction"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                        onClick={() => setTxToDelete(t)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
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
                    setEditingTransaction(null);
                }}
                editingTransaction={editingTransaction}
            />

            <AlertDialog open={!!txToDelete} onOpenChange={() => setTxToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Archive Transaction?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will move the transaction to the archive and re-calculate the supplier balance. You can restore it later from the "Show Archived" view.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-orange-600 hover:bg-orange-700 font-bold">
                            Archive Transaction
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
