import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../components/ui/dialog';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { api } from '../../../services/api';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { Supplier } from '../../../types';

interface AddSupplierDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    editingSupplier?: Supplier | null;
    portal: 'retail' | 'wholesale';
}

export function AddSupplierDialog({ open, onOpenChange, onSuccess, editingSupplier, portal }: AddSupplierDialogProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: ''
    });

    useEffect(() => {
        if (editingSupplier) {
            setFormData({
                name: editingSupplier.name,
                contact_person: editingSupplier.contact_person || '',
                phone: editingSupplier.phone || '',
                email: editingSupplier.email || '',
                address: editingSupplier.address || ''
            });
        } else {
            setFormData({
                name: '',
                contact_person: '',
                phone: '',
                email: '',
                address: ''
            });
        }
    }, [editingSupplier, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            toast.error('Supplier name is required');
            return;
        }

        setLoading(true);
        try {
            await api.upsertSupplier({
                id: editingSupplier?.id || undefined,
                portal: editingSupplier?.portal || portal,
                ...formData
            });
            toast.success(editingSupplier ? 'Supplier updated' : 'Supplier added');
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error('Failed to save supplier:', error);
            toast.error('Failed to save supplier');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{editingSupplier ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Vendor Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. Kathmandu Dairy"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="contact">Contact Person</Label>
                        <Input
                            id="contact"
                            placeholder="e.g. Ramesh Giri"
                            value={formData.contact_person}
                            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                placeholder="98XXXXXXXX"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="vendor@example.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Input
                            id="address"
                            placeholder="e.g. Tinkune, Kathmandu"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
                            disabled={loading} 
                            className={`${portal === 'wholesale' ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-100' : 'bg-purple-600 hover:bg-purple-700 shadow-purple-100'} rounded-xl font-bold min-w-[100px] text-white shadow-lg`}
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingSupplier ? 'Save Changes' : 'Add Vendor'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
