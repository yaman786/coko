import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { api } from '../../../services/api';
import { toast } from 'sonner';
import { Loader2, PlusCircle, ArrowUpCircle, Calendar } from 'lucide-react';
import type { Supplier, SupplierTransaction } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import { compressImage } from '../../../utils/image';

interface RecordTransactionDialogProps {
    supplier: Supplier;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    editingTransaction?: SupplierTransaction | null;
}

export function RecordTransactionDialog({ supplier, open, onOpenChange, onSuccess, editingTransaction }: RecordTransactionDialogProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [type, setType] = useState<'BILL' | 'PAYMENT'>('BILL');
    const [formData, setFormData] = useState({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        payment_method: 'Cash',
        description: '',
        reference_number: '',
        attachment_url: '',
        due_date: ''
    });

    useEffect(() => {
        if (editingTransaction) {
            setType(editingTransaction.type);
            setFormData({
                amount: editingTransaction.amount.toString(),
                date: new Date(editingTransaction.date).toISOString().split('T')[0],
                payment_method: editingTransaction.payment_method || 'Cash',
                description: editingTransaction.description || '',
                reference_number: editingTransaction.reference_number || '',
                attachment_url: editingTransaction.attachment_url || '',
                due_date: editingTransaction.due_date ? new Date(editingTransaction.due_date).toISOString().split('T')[0] : ''
            });
        } else {
            setType('BILL');
            setFormData({
                amount: '',
                date: new Date().toISOString().split('T')[0],
                payment_method: 'Cash',
                description: '',
                reference_number: '',
                attachment_url: '',
                due_date: ''
            });
        }
    }, [editingTransaction, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error('Invalid amount');
            return;
        }

        setLoading(true);
        try {
            await api.upsertSupplierTransaction({
                id: editingTransaction?.id,
                supplier_id: supplier.id,
                type,
                amount: parseFloat(formData.amount),
                date: new Date(formData.date),
                payment_method: type === 'PAYMENT' ? formData.payment_method : undefined,
                description: formData.description,
                reference_number: formData.reference_number,
                attachment_url: formData.attachment_url,
                due_date: type === 'BILL' && formData.due_date ? new Date(formData.due_date) : undefined,
                created_by: editingTransaction?.created_by || user?.email || 'System'
            });
            toast.success(editingTransaction ? 'Transaction updated' : (type === 'BILL' ? 'Bill recorded' : 'Payment recorded'));
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to record transaction:', error);
            toast.error('Failed to record transaction');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // Compress image if it's a photo
            const processedFile = await compressImage(file);
            const url = await api.uploadSupplierAttachment(processedFile);
            setFormData(prev => ({ ...prev, attachment_url: url }));
            toast.success('Document uploaded');
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload document');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader className="space-y-4">
                    <DialogTitle className="flex items-center gap-2">
                        {type === 'BILL' ? <PlusCircle className="text-orange-500" /> : <ArrowUpCircle className="text-green-500" />}
                        Record {type === 'BILL' ? 'Purchase Bill' : 'Payment'}
                    </DialogTitle>
                    <div className="flex p-1 bg-slate-100 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setType('BILL')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                type === 'BILL' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Record Bill
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('PAYMENT')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                                type === 'PAYMENT' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            Record Payment
                        </button>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date">Date</Label>
                            <Input
                                id="date"
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount</Label>
                            <Input
                                id="amount"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                required
                                className="rounded-xl font-bold"
                            />
                        </div>
                    </div>

                    {type === 'BILL' && (
                        <div className="space-y-2">
                            <Label htmlFor="due_date" className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-orange-500" />
                                Due Date (Optional)
                            </Label>
                            <Input
                                id="due_date"
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                className="rounded-xl border-orange-100 focus:border-orange-500"
                            />
                        </div>
                    )}

                    {type === 'PAYMENT' && (
                        <div className="space-y-2">
                            <Label htmlFor="method">Payment Method</Label>
                            <Select 
                                value={formData.payment_method} 
                                onValueChange={(val) => setFormData({ ...formData, payment_method: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select method" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                    <SelectItem value="Card">Card</SelectItem>
                                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                    <SelectItem value="Fonepay">Fonepay</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="ref">Reference # (Optional)</Label>
                        <Input
                            id="ref"
                            placeholder={type === 'BILL' ? 'Invoice Number' : 'Receipt / Transaction ID'}
                            value={formData.reference_number}
                            onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="desc">Note (Optional)</Label>
                        <Input
                            id="desc"
                            placeholder="Add a short note..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="rounded-xl"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="attachment" className="flex items-center gap-2">
                            Attachment (Bill/Receipt)
                            {uploading && <Loader2 className="h-3 w-3 animate-spin text-purple-600" />}
                            {formData.attachment_url && <span className="text-[10px] text-green-600 font-bold uppercase tracking-tighter">✓ Attached</span>}
                        </Label>
                        <Input
                            id="attachment"
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleFileUpload}
                            className="rounded-xl cursor-pointer text-xs"
                            disabled={uploading}
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => onOpenChange(false)}
                            className="rounded-xl border-slate-200"
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={loading || uploading} 
                            className={`rounded-xl font-bold min-w-[120px] ${
                                type === 'BILL' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'
                            }`}
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingTransaction ? 'Update Changes' : `Save ${type === 'BILL' ? 'Bill' : 'Payment'}`}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
