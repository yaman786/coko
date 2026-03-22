import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Pencil, Loader2 } from 'lucide-react';
import { wholesaleApi } from '../../../services/wholesaleApi';
import { toast } from 'sonner';
import type { WsClientTransaction } from '../../../types';

interface EditTransactionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transaction: WsClientTransaction | null;
    clientId: string;
    onSuccess: () => void;
}

export function EditTransactionDialog({ open, onOpenChange, transaction, clientId, onSuccess }: EditTransactionDialogProps) {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Cash');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (transaction && open) {
            setAmount(transaction.amount.toString());
            setMethod(transaction.payment_method || 'Cash');
            setNotes(transaction.reference_note || '');
        }
    }, [transaction, open]);

    if (!transaction) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        try {
            setIsSubmitting(true);
            await wholesaleApi.updateClientTransaction(
                transaction.id,
                clientId,
                Number(amount),
                transaction.amount,
                transaction.type as 'PAYMENT_RECEIVED' | 'ORDER_CREDIT',
                {
                    amount: Number(amount),
                    payment_method: method,
                    reference_note: notes || undefined
                }
            );
            toast.success("Transaction updated successfully!");
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to update transaction:", error);
            toast.error("Failed to update transaction. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white rounded-2xl">
                <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                            <Pencil className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black tracking-tight text-slate-800">
                                Edit Transaction
                            </DialogTitle>
                            <DialogDescription className="text-sm font-medium tracking-tight text-slate-500">
                                {transaction.type === 'PAYMENT_RECEIVED' ? 'Updating Payment Entry' : 'Updating Order Credit'}
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Amount (Rs.)</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition-all"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Payment Method</label>
                        <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-slate-500 outline-none transition-all"
                        >
                            <option value="Cash">Cash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                            <option value="eSewa/Fonepay">eSewa / Fonepay</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            Notes / Reference
                            <span className="text-xs font-medium text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-slate-500 outline-none resize-none transition-all"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !amount}
                        className="w-full py-3 mt-2 bg-slate-800 text-white rounded-xl font-bold tracking-tight hover:bg-slate-900 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-sm"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <Pencil className="w-5 h-5" />
                                <span>Save Changes</span>
                            </>
                        )}
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
