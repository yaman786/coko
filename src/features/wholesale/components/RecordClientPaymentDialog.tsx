import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../../../components/ui/dialog';
import { Coins, Loader2 } from 'lucide-react';
import { wholesaleApi } from '../../../services/wholesaleApi';
import { toast } from 'sonner';
import type { WsClient } from '../../../types';

interface RecordClientPaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    client: WsClient | null;
    onSuccess: () => void;
}

export function RecordClientPaymentDialog({ open, onOpenChange, client, onSuccess }: RecordClientPaymentDialogProps) {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('Cash');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!client) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        try {
            setIsSubmitting(true);
            await wholesaleApi.recordClientPayment(
                client.id,
                Number(amount),
                method,
                notes || undefined
            );
            toast.success(`Payment of Rs. ${Number(amount).toLocaleString()} recorded successfully for ${client.name}`);
            onSuccess();
            onOpenChange(false);
            // Reset form
            setAmount('');
            setMethod('Cash');
            setNotes('');
        } catch (error) {
            console.error("Failed to record payment:", error);
            toast.error("Failed to record payment. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-white rounded-2xl">
                <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center">
                            <Coins className="w-5 h-5 text-sky-600" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black tracking-tight text-slate-800">
                                Receive Payment
                            </DialogTitle>
                            <DialogDescription className="text-sm font-medium tracking-tight text-slate-500">
                                Record payment received from {client.name}
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium text-slate-500">Current Balance Owed</span>
                            <span className="text-lg font-bold text-sky-700">Rs. {client.balance.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-400 font-medium">Any payment will deduct from this balance.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Payment Amount (Rs.)</label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="e.g. 5000"
                            className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition-all placeholder:text-slate-400"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700">Payment Method</label>
                        <select
                            value={method}
                            onChange={(e) => setMethod(e.target.value)}
                            className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-sky-500 outline-none transition-all"
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
                            placeholder="e.g. Cheque #12345 or Transfer Note"
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium focus:ring-2 focus:ring-sky-500 outline-none resize-none transition-all placeholder:text-slate-400"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !amount}
                        className="w-full py-3 mt-2 bg-sky-600 text-white rounded-xl font-bold tracking-tight hover:bg-sky-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-sm"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Recording...</span>
                            </>
                        ) : (
                            <>
                                <Coins className="w-5 h-5" />
                                <span>Confirm Payment</span>
                            </>
                        )}
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
