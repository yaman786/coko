import { useState } from 'react';
import { Card, CardContent, CardHeader } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Phone, Mail, MapPin, History, Wallet, ArrowUpRight, ArrowDownLeft, ChevronLeft } from 'lucide-react';
import { AddClientDialog } from './AddClientDialog';
import { RecordTransactionDialog } from './RecordTransactionDialog';
import type { Supplier } from '../../../types';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api';

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

    const { data: transactions = [], refetch } = useQuery({
        queryKey: ['supplier-transactions', supplier.id],
        queryFn: () => api.getSupplierTransactions(supplier.id)
    });

    const sortedTransactions = [...transactions].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

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
                            onClick={() => setIsTransactionDialogOpen(true)}
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
            <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-6 bg-slate-50/20">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Balance</p>
                        <p className={`text-xl font-black ${supplier.current_balance > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                            ₹{supplier.current_balance.toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Payment</p>
                        <p className="text-xl font-black text-slate-700">
                            {sortedTransactions.find(t => t.type === 'PAYMENT') ? `₹${sortedTransactions.find(t => t.type === 'PAYMENT')?.amount.toLocaleString()}` : 'N/A'}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Activity</p>
                        <p className="text-xl font-black text-slate-700">
                            {sortedTransactions.length} items
                        </p>
                    </div>
                </div>

                {/* Transaction List */}
                <div className="flex-1 overflow-y-auto px-6">
                    <div className="flex items-center gap-2 mb-4 mt-2">
                        <History className="w-4 h-4 text-slate-400" />
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Activity History</h4>
                    </div>
                    <div className="space-y-3 pb-6">
                        {sortedTransactions.map((t) => (
                            <div key={t.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-white hover:border-slate-200 transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2.5 rounded-xl ${
                                        t.type === 'PAYMENT' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                                    }`}>
                                        {t.type === 'PAYMENT' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700">{t.description || (t.type === 'PAYMENT' ? 'Payment Out' : 'Purchase In')}</p>
                                        <p className="text-[10px] font-medium text-slate-400">
                                            {format(new Date(t.date), 'PPP p')}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-black ${t.type === 'PAYMENT' ? 'text-emerald-600' : 'text-orange-600'}`}>
                                        {t.type === 'PAYMENT' ? '-' : '+'} ₹{t.amount.toLocaleString()}
                                    </p>
                                    <p className="text-[10px] font-medium text-slate-400">Balance Tracked</p>
                                </div>
                            </div>
                        ))}
                        {sortedTransactions.length === 0 && (
                            <div className="text-center py-20 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
                                <Wallet className="w-12 h-12 text-slate-200 mx-auto mb-4" />
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
                onSuccess={() => {
                    refetch();
                    onRefreshSupplier();
                }}
                portal={portal}
            />
        </Card>
    );
}
