import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { api } from '../../../services/api';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import type { Expense } from '../../../types';

interface AddExpenseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    editingExpense?: Expense | null;
}

const CATEGORIES = ['Rent', 'Salary', 'Inventory', 'Utilities', 'Marketing', 'Maintenance', 'Other'];

export function AddExpenseDialog({ open, onOpenChange, onSuccess, editingExpense }: AddExpenseDialogProps) {
    const { session } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        amount: '',
        category: 'Other',
        description: '',
        payment_method: 'Cash',
        date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        if (editingExpense) {
            setFormData({
                amount: editingExpense.amount.toString(),
                category: editingExpense.category,
                description: editingExpense.description || '',
                payment_method: editingExpense.payment_method || 'Cash',
                date: new Date(editingExpense.date).toISOString().split('T')[0]
            });
        } else {
            setFormData({
                amount: '',
                category: 'Other',
                description: '',
                payment_method: 'Cash',
                date: new Date().toISOString().split('T')[0]
            });
        }
    }, [editingExpense, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error('Invalid amount');
            return;
        }

        setLoading(true);
        try {
            await api.upsertExpense({
                id: editingExpense?.id || undefined,
                amount: parseFloat(formData.amount),
                category: formData.category,
                description: formData.description,
                date: new Date(formData.date),
                payment_method: formData.payment_method,
                cashier_id: session?.user.email || 'system',
                cashier_name: session?.user.email?.split('@')[0] || 'System',
            });
            toast.success(editingExpense ? 'Expense updated' : 'Expense recorded');
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to save expense:', error);
            toast.error('Failed to save expense');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{editingExpense ? 'Edit Expense' : 'Record New Expense'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="date" className="text-right">Date</Label>
                        <Input
                            id="date"
                            type="date"
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="category" className="text-right">Category</Label>
                        <div className="col-span-3">
                            <Select 
                                value={formData.category} 
                                onValueChange={(val) => setFormData({ ...formData, category: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="method" className="text-right">Method</Label>
                        <div className="col-span-3">
                            <Select 
                                value={formData.payment_method} 
                                onValueChange={(val) => setFormData({ ...formData, payment_method: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Payment Method" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Cash">Cash</SelectItem>
                                    <SelectItem value="Card">Card</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="amount" className="text-right">Amount</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="description" className="text-right">Note</Label>
                        <Input
                            id="description"
                            placeholder="Short description..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="col-span-3"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingExpense ? 'Update Expense' : 'Save Expense'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
